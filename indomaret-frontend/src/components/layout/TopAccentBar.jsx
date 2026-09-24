// Garis aksen tricolor khas Indomaret (biru - merah - kuning) yang selalu
// menempel di baris paling atas viewport, persis seperti di desain Stitch.
export default function TopAccentBar() {
  return (
    <div className="fixed top-0 left-0 right-0 h-1.5 z-[60] flex">
      <div className="h-full w-1/3 bg-idm-blue" />
      <div className="h-full w-1/3 bg-idm-red" />
      <div className="h-full w-1/3 bg-idm-yellow" />
    </div>
  );
}
