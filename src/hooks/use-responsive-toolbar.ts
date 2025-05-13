import { useEffect, useRef, useState } from "react";

export function useResponsiveToolbar() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!toolbarRef.current) return;

    const observer = new ResizeObserver(() => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const toolbarRect = toolbar.getBoundingClientRect();
      const newHiddenItems = new Set<string>();

      // Check each child element
      toolbar.childNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const rect = node.getBoundingClientRect();
          // If the element's right edge is beyond the toolbar's right edge
          if (rect.right > toolbarRect.right) {
            const id = node.id;
            if (id) {
              newHiddenItems.add(id);
            }
          }
        }
      });

      setHiddenItems(newHiddenItems);
    });

    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  return {
    toolbarRef,
    hiddenItems,
  };
}
