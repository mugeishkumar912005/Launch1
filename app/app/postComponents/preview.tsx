interface Props {
  caption: string;
  selectedPlatforms: string[];
}

export default function Preview({
  caption,
  selectedPlatforms,
}: Props) {
  return (
    <div className="space-y-6">
      {selectedPlatforms.includes("INSTAGRAM") && (
        <Card
          platform="Instagram"
          caption={caption}
          color="pink"
        />
      )}

      {selectedPlatforms.includes("LINKEDIN") && (
        <Card
          platform="LinkedIn"
          caption={caption}
          color="blue"
        />
      )}

      {selectedPlatforms.includes("X") && (
        <Card
          platform="X"
          caption={caption}
          color="black"
        />
      )}

      {selectedPlatforms.includes("YOUTUBE") && (
        <Card
          platform="YouTube"
          caption={caption}
          color="red"
        />
      )}
    </div>
  );
}

function Card({
  platform,
  caption,
  color,
}: {
  platform: string;
  caption: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-full bg-${color}-500`}
        />

        <div>
          <h3 className="font-bold">{platform}</h3>
          <p className="text-xs text-gray-500">
            @your_username
          </p>
        </div>
      </div>

      <div className="mb-4 aspect-square rounded-lg bg-gray-200" />

      <p>{caption || "Start typing..."}</p>
    </div>
  );
}