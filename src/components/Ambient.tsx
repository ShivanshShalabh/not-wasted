/** Fixed page backdrop: "+" grid and slowly drifting peach and sage blobs. Purely decorative. */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="bg-plus-grid absolute inset-0" />
      <div className="animate-blob absolute -top-[20%] left-[18%] h-[70vh] w-[55vw] rounded-full bg-[#f2b98f]/45 blur-[110px]" />
      <div className="animate-blob absolute -bottom-[25%] -right-[10%] h-[70vh] w-[50vw] rounded-full bg-sage-500/35 blur-[120px] [animation-delay:-8s]" />
      <div className="animate-blob absolute top-[35%] -left-[15%] h-[50vh] w-[35vw] rounded-full bg-[#f7dcc2]/50 blur-[100px] [animation-delay:-14s]" />
    </div>
  );
}
