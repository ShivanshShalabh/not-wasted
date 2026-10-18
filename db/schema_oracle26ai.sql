-- =====================================================================
-- Not Wasted — Surplus saved
-- Oracle AI Database 26ai / Autonomous Database schema
-- Features: atomic split-claim decrement, Oracle Spatial proximity,
--           AI Vector Search matching, JSON attributes, Select AI narrative.
-- =====================================================================

-- ---------- Donor side ----------
CREATE TABLE organizations (
  org_id        VARCHAR2(40) PRIMARY KEY,
  name          VARCHAR2(200) NOT NULL,
  org_kind      VARCHAR2(20)  NOT NULL CHECK (org_kind IN ('DONOR','RECIPIENT')),
  address       VARCHAR2(300),
  location      SDO_GEOMETRY,
  created_at    TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Many departments / teams per institution (facilities, catering, event hosts).
CREATE TABLE donor_departments (
  dept_id       VARCHAR2(40) PRIMARY KEY,
  org_id        VARCHAR2(40) NOT NULL REFERENCES organizations(org_id),
  name          VARCHAR2(200) NOT NULL,
  contact       VARCHAR2(200)
);

-- ---------- Recipient side ----------
CREATE TABLE recipient_orgs (
  org_id          VARCHAR2(40) PRIMARY KEY REFERENCES organizations(org_id),
  org_type        VARCHAR2(60),
  verified        CHAR(1) DEFAULT 'N' CHECK (verified IN ('Y','N')),
  notify_channel  VARCHAR2(10) CHECK (notify_channel IN ('Email','SMS')),
  contact         VARCHAR2(200),
  need_profile    VARCHAR2(1000),           -- free text of what they serve / need
  has_truck       CHAR(1) DEFAULT 'N',
  cold_storage    CHAR(1) DEFAULT 'N',
  need_embedding  VECTOR(384, FLOAT32)      -- embedding of need_profile
);

CREATE TABLE recipient_capacity (
  org_id        VARCHAR2(40) REFERENCES recipient_orgs(org_id),
  category      VARCHAR2(20) CHECK (category IN ('food','furniture','clothing','other')),
  capacity_qty  NUMBER NOT NULL CHECK (capacity_qty >= 0),
  PRIMARY KEY (org_id, category)
);

-- ---------- Events & surplus ----------
CREATE TABLE events (
  event_id          VARCHAR2(40) PRIMARY KEY,
  dept_id           VARCHAR2(40) REFERENCES donor_departments(dept_id),
  name              VARCHAR2(200) NOT NULL,
  event_type        VARCHAR2(40),
  start_ts          TIMESTAMP NOT NULL,
  end_ts            TIMESTAMP NOT NULL,
  rsvp_count        NUMBER,
  food_ordered      NUMBER,
  meal_description  VARCHAR2(1000),
  storage_type      VARCHAR2(30),
  transport         VARCHAR2(30),
  predicted_surplus NUMBER,
  ping_sent         CHAR(1) DEFAULT 'N',
  CONSTRAINT chk_event_time CHECK (end_ts > start_ts)
);

CREATE TABLE surplus_batches (
  batch_id        VARCHAR2(40) PRIMARY KEY,
  event_id        VARCHAR2(40) REFERENCES events(event_id),   -- NULL for direct surplus posts
  dept_id         VARCHAR2(40) REFERENCES donor_departments(dept_id),
  category        VARCHAR2(20) NOT NULL CHECK (category IN ('food','furniture','clothing','other')),
  title           VARCHAR2(200) NOT NULL,
  unit            VARCHAR2(30) NOT NULL,
  total_qty       NUMBER NOT NULL CHECK (total_qty > 0),
  remaining_qty   NUMBER NOT NULL,
  status          VARCHAR2(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','FULLY_CLAIMED')),
  attributes      JSON,                      -- allergens / condition / sizes from OCI GenAI Vision
  pickup_location SDO_GEOMETRY,
  posted_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
  pickup_by       TIMESTAMP NOT NULL,
  item_embedding  VECTOR(384, FLOAT32),
  CONSTRAINT chk_remaining CHECK (remaining_qty BETWEEN 0 AND total_qty)
);

CREATE TABLE claims (
  claim_id      VARCHAR2(40) PRIMARY KEY,
  batch_id      VARCHAR2(40) NOT NULL REFERENCES surplus_batches(batch_id),
  recipient_id  VARCHAR2(40) NOT NULL REFERENCES recipient_orgs(org_id),
  qty           NUMBER NOT NULL CHECK (qty > 0),
  claimed_at    TIMESTAMP DEFAULT SYSTIMESTAMP,
  pickup_by     TIMESTAMP NOT NULL,
  eta_minutes   NUMBER,
  status        VARCHAR2(20) DEFAULT 'CLAIMED' CHECK (status IN ('CLAIMED','PICKED_UP','CANCELLED'))
);

CREATE TABLE handoffs (
  claim_id      VARCHAR2(40) PRIMARY KEY REFERENCES claims(claim_id),
  verified_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
  verified_by   VARCHAR2(200)
);

-- ---------- Spatial metadata & indexes ----------
INSERT INTO user_sdo_geom_metadata (table_name, column_name, diminfo, srid)
VALUES ('ORGANIZATIONS', 'LOCATION',
  SDO_DIM_ARRAY(SDO_DIM_ELEMENT('LONG', -180, 180, 0.5), SDO_DIM_ELEMENT('LAT', -90, 90, 0.5)), 4326);
INSERT INTO user_sdo_geom_metadata (table_name, column_name, diminfo, srid)
VALUES ('SURPLUS_BATCHES', 'PICKUP_LOCATION',
  SDO_DIM_ARRAY(SDO_DIM_ELEMENT('LONG', -180, 180, 0.5), SDO_DIM_ELEMENT('LAT', -90, 90, 0.5)), 4326);

CREATE INDEX idx_org_location   ON organizations(location)          INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2;
CREATE INDEX idx_batch_location ON surplus_batches(pickup_location) INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2;
CREATE INDEX idx_batch_status   ON surplus_batches(status, category);
CREATE VECTOR INDEX idx_need_vec ON recipient_orgs(need_embedding) ORGANIZATION NEIGHBOR PARTITIONS DISTANCE COSINE;

-- =====================================================================
-- 1) Nearby verified recipients that accept the batch category (Spatial)
-- =====================================================================
-- :batch_id, :radius_mi
SELECT o.org_id, o.name, rc.capacity_qty,
       ROUND(SDO_GEOM.SDO_DISTANCE(o.location, b.pickup_location, 0.5, 'unit=MILE'), 1) AS distance_mi
FROM   surplus_batches b
JOIN   organizations o       ON o.org_kind = 'RECIPIENT'
JOIN   recipient_orgs r      ON r.org_id = o.org_id AND r.verified = 'Y'
JOIN   recipient_capacity rc ON rc.org_id = o.org_id AND rc.category = b.category AND rc.capacity_qty > 0
WHERE  b.batch_id = :batch_id
AND    SDO_WITHIN_DISTANCE(o.location, b.pickup_location, 'distance=' || :radius_mi || ' unit=MILE') = 'TRUE'
ORDER  BY distance_mi;

-- =====================================================================
-- 2) Atomic split claim — race-safe: two food banks can never over-claim
-- =====================================================================
CREATE OR REPLACE PROCEDURE claim_batch (
  p_batch_id     IN VARCHAR2,
  p_recipient_id IN VARCHAR2,
  p_claim_qty    IN NUMBER,
  p_claim_id     OUT VARCHAR2
) AS
  v_category  surplus_batches.category%TYPE;
  v_pickup_by surplus_batches.pickup_by%TYPE;
BEGIN
  -- Decrement only if enough remains; row lock serializes concurrent claimers.
  UPDATE surplus_batches
     SET remaining_qty = remaining_qty - p_claim_qty,
         status = CASE WHEN remaining_qty - p_claim_qty = 0 THEN 'FULLY_CLAIMED' ELSE 'AVAILABLE' END
   WHERE batch_id = p_batch_id
     AND status = 'AVAILABLE'
     AND remaining_qty >= p_claim_qty
  RETURNING category, pickup_by INTO v_category, v_pickup_by;

  IF SQL%ROWCOUNT = 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'Insufficient remaining quantity or batch fully claimed');
  END IF;

  -- Decrement recipient storage capacity for that category with the same guard.
  UPDATE recipient_capacity
     SET capacity_qty = capacity_qty - p_claim_qty
   WHERE org_id = p_recipient_id
     AND category = v_category
     AND capacity_qty >= p_claim_qty;

  IF SQL%ROWCOUNT = 0 THEN
    ROLLBACK;
    RAISE_APPLICATION_ERROR(-20002, 'Claim exceeds recipient capacity or category not accepted');
  END IF;

  p_claim_id := 'clm_' || LOWER(RAWTOHEX(SYS_GUID()));
  INSERT INTO claims (claim_id, batch_id, recipient_id, qty, pickup_by)
  VALUES (p_claim_id, p_batch_id, p_recipient_id, p_claim_qty, v_pickup_by);
  COMMIT;
END claim_batch;
/

-- Cancel returns quantity to the batch and capacity to the recipient.
CREATE OR REPLACE PROCEDURE cancel_claim (p_claim_id IN VARCHAR2) AS
  v_batch claims.batch_id%TYPE; v_rcp claims.recipient_id%TYPE; v_qty claims.qty%TYPE; v_cat surplus_batches.category%TYPE;
BEGIN
  UPDATE claims SET status = 'CANCELLED'
   WHERE claim_id = p_claim_id AND status = 'CLAIMED'
  RETURNING batch_id, recipient_id, qty INTO v_batch, v_rcp, v_qty;
  IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20003, 'Only open claims can be cancelled'); END IF;

  UPDATE surplus_batches SET remaining_qty = remaining_qty + v_qty, status = 'AVAILABLE'
   WHERE batch_id = v_batch RETURNING category INTO v_cat;
  UPDATE recipient_capacity SET capacity_qty = capacity_qty + v_qty WHERE org_id = v_rcp AND category = v_cat;
  COMMIT;
END cancel_claim;
/

-- =====================================================================
-- 3) AI Vector Search — rank recipients by fit to a batch's contents
-- =====================================================================
SELECT o.name, VECTOR_DISTANCE(r.need_embedding, b.item_embedding, COSINE) AS fit_distance
FROM   surplus_batches b, recipient_orgs r JOIN organizations o ON o.org_id = r.org_id
WHERE  b.batch_id = :batch_id
ORDER  BY fit_distance
FETCH  APPROX FIRST 5 ROWS ONLY;

-- =====================================================================
-- 4) Select AI — natural-language impact reporting via OCI Generative AI
-- =====================================================================
BEGIN
  DBMS_CLOUD_AI.CREATE_PROFILE(
    profile_name => 'NOT_WASTED_AI',
    attributes   => '{"provider": "oci",
                      "credential_name": "OCI_GENAI_CRED",
                      "oci_compartment_id": "<compartment_ocid>",
                      "region": "us-chicago-1",
                      "object_list": [{"owner": "NOT_WASTED", "name": "SURPLUS_BATCHES"},
                                      {"owner": "NOT_WASTED", "name": "CLAIMS"},
                                      {"owner": "NOT_WASTED", "name": "ORGANIZATIONS"}]}');
  DBMS_CLOUD_AI.SET_PROFILE('NOT_WASTED_AI');
END;
/
-- SELECT AI NARRATE how many meal packets, furniture pieces and clothing items were rescued this month by each donor;
-- SELECT AI SHOWSQL which recipients missed their pickup window last week;

-- KPI view: fell-through claims and time-to-claim
CREATE OR REPLACE VIEW v_claim_kpis AS
SELECT b.category,
       SUM(CASE WHEN c.status <> 'CANCELLED' THEN c.qty END)                         AS units_rescued,
       COUNT(CASE WHEN c.status = 'CLAIMED' AND c.pickup_by < SYSTIMESTAMP THEN 1 END) AS fell_through,
       ROUND(AVG(EXTRACT(MINUTE FROM (c.claimed_at - b.posted_at))
               + EXTRACT(HOUR FROM (c.claimed_at - b.posted_at)) * 60), 1)              AS avg_minutes_to_claim
FROM   claims c JOIN surplus_batches b ON b.batch_id = c.batch_id
GROUP  BY b.category;

-- =====================================================================
-- Seed data (mirrors src/lib/seed.ts)
-- =====================================================================
INSERT INTO organizations VALUES ('org_vu', 'Vanderbilt University', 'DONOR', '2201 West End Ave, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.8027, 36.1447, NULL), NULL, NULL), SYSTIMESTAMP);
INSERT INTO organizations VALUES ('rcp_second_harvest', 'Second Harvest Metro Hub', 'RECIPIENT', '331 Great Circle Rd, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.8232, 36.1880, NULL), NULL, NULL), SYSTIMESTAMP);
INSERT INTO organizations VALUES ('rcp_eastside', 'Eastside Community Pantry', 'RECIPIENT', '1010 Gallatin Ave, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.7531, 36.1866, NULL), NULL, NULL), SYSTIMESTAMP);
INSERT INTO organizations VALUES ('rcp_st_lukes', 'St. Luke''s Soup Kitchen', 'RECIPIENT', '5601 New York Ave, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.8587, 36.1531, NULL), NULL, NULL), SYSTIMESTAMP);
INSERT INTO organizations VALUES ('rcp_music_city_furniture', 'Music City Furniture Bank', 'RECIPIENT', '2400 Clifton Ave, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.8212, 36.1671, NULL), NULL, NULL), SYSTIMESTAMP);
INSERT INTO organizations VALUES ('rcp_hope_threads', 'Hope Threads Clothing Closet', 'RECIPIENT', '1800 Dickerson Pike, Nashville, TN', SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(-86.7700, 36.2010, NULL), NULL, NULL), SYSTIMESTAMP);

INSERT INTO recipient_orgs (org_id, org_type, verified, notify_channel, contact, need_profile) VALUES ('rcp_second_harvest', 'Food Bank', 'Y', 'Email', 'dispatch@secondharvest-metro.org', 'Regional food bank; refrigerated and dry storage');
INSERT INTO recipient_orgs (org_id, org_type, verified, notify_channel, contact, need_profile) VALUES ('rcp_eastside', 'Food Pantry', 'Y', 'SMS', '+1 615-555-0142', 'Neighborhood pantry; prepared meals for families');
INSERT INTO recipient_orgs (org_id, org_type, verified, notify_channel, contact, need_profile) VALUES ('rcp_st_lukes', 'Soup Kitchen & Shelter', 'Y', 'Email', 'meals@stlukes-nash.org', 'Hot meals and clothing for unhoused neighbors');
INSERT INTO recipient_orgs (org_id, org_type, verified, notify_channel, contact, need_profile) VALUES ('rcp_music_city_furniture', 'Furniture Bank', 'Y', 'Email', 'pickups@mcfurniturebank.org', 'Furniture for families leaving homelessness');
INSERT INTO recipient_orgs (org_id, org_type, verified, notify_channel, contact, need_profile) VALUES ('rcp_hope_threads', 'Clothing Closet', 'Y', 'SMS', '+1 615-555-0199', 'Clothing and linens for shelters and job seekers');

INSERT INTO recipient_capacity VALUES ('rcp_second_harvest', 'food', 120);
INSERT INTO recipient_capacity VALUES ('rcp_eastside', 'food', 55);
INSERT INTO recipient_capacity VALUES ('rcp_st_lukes', 'food', 80);
INSERT INTO recipient_capacity VALUES ('rcp_st_lukes', 'clothing', 150);
INSERT INTO recipient_capacity VALUES ('rcp_music_city_furniture', 'furniture', 60);
INSERT INTO recipient_capacity VALUES ('rcp_music_city_furniture', 'other', 40);
INSERT INTO recipient_capacity VALUES ('rcp_hope_threads', 'clothing', 300);
INSERT INTO recipient_capacity VALUES ('rcp_hope_threads', 'other', 25);
COMMIT;
