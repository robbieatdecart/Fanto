import React from 'react';

type BlockProps = {
  text: string;
  id: string;
};

export function Block({ text, id }: BlockProps) {
  return (
    <div
      id={id}
      className="bg-yellow-300 text-black font-bold rounded px-4 py-2 shadow cursor-move mb-2"
    >
      {text}
    </div>
  );
}