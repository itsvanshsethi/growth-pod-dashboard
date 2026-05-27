'use client';

interface ProgressBarProps {
  value: number;
  label?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ value, label, height = 3, showLabel = false }: ProgressBarProps) {
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-[#8E8E8E] mb-1">
          <span>{label || 'Progress'}</span>
          <span>{value}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-[#F0ECE8]"
        style={{ height }}
      >
        <div
          className="h-full rounded-full bg-[#1B1B1B] transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
