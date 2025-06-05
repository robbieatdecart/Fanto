import React from 'react';

type DropZoneProps = {
  children: React.ReactNode;
};

export function DropZone({ children }: DropZoneProps) {
  return (
    <div className="border-4 border-dashed border-gray-400 p-6 rounded min-h-[200px] flex flex-col gap-4 items-center justify-center">
      <p className="text-sm text-gray-500">Drop prompt blocks here</p>
      {children}
    </div>
  );
}