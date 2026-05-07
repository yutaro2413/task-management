"use client";

// 長押し→ドラッグでリストを並び替えできる薄いラッパー。
// PointerSensor + delay 200ms 制約で「タップ長押し」アクティベーションを実現。
// 短いタップやスクロールはドラッグを開始しない (tolerance 5px)。
//
// 使い方:
//   <SortableList ids={items.map((x) => x.id)} onReorder={(newIds) => ...}>
//     {items.map((x) => (
//       <SortableItem key={x.id} id={x.id}>
//         {(handleProps) => (
//           <div {...handleProps}>{x.name}</div>
//         )}
//       </SortableItem>
//     ))}
//   </SortableList>
//
// handleProps を「掴める領域」だけに付ければ、テキスト入力と両立できる。

import { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (newIds: string[]) => void;
  children: ReactNode;
}) {
  // 200ms 押し続けないと drag が起動しない = 短いタップ・スクロールは通常の動作のまま
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export type SortableHandleProps = ReturnType<typeof useSortable>["listeners"] & {
  ref: ReturnType<typeof useSortable>["setActivatorNodeRef"];
};

/**
 * SortableItem は子要素に「ドラッグハンドルプロパティ」を渡す render-prop パターン。
 * children(handleProps) で受け取って、掴める領域 (アイコンや行全体) に spread する。
 */
export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (handleProps: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
    isDragging: boolean;
  }) => ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    listeners,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    touchAction: "manipulation",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}
