import React from 'react';

type HistoryProps = {
  images: string[];
};

export function PromptHistory({ images }: HistoryProps) {
  return (
    <div className="mt-6">
      <h2 className="font-semibold mb-2">🕘 Prompt History</h2>
      <div className="flex gap-2 overflow-x-auto">
        {images.map((img, i) => (
          <img
            key={i}
            src={`data:image/png;base64,${img}`}
            alt={`Step ${i}`}
            className="h-24 w-24 object-cover rounded shadow"
          />
        ))}
      </div>
    </div>
  );
}