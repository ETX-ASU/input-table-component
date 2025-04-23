import { useEffect, useRef, useState } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  }[];
}

export function ContextMenu({ x, y, onClose, options }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to ensure menu stays within viewport
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    // Adjust position if needed to keep menu in viewport
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }

    // Close menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [x, y, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {options.map((option, index) => (
        <button
          key={index}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100"
          onClick={() => {
            option.onClick();
            onClose();
          }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
