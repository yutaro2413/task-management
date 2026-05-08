"use client";

// 長押し→ドラッグでリストを並び替えできる薄いラッパー。
// PointerSensor + delay 200ms 制約で「タップ長押し」アクティベーションを実現。
// 短いタップやスクロールはドラッグを開始しない (tolerance 5px)。
//
// 使い方:
//   <SortableList ids={items.map((x) => x.id)} onReorder={(newIds) => ...}>
//     {items.map((x) => (
//       <SortableItem key={x.id} id={x.id}>
//         {({ listeners, setActivatorNodeRef, handleStyle, isDragging }) => (
//           <div>
//             <span ref={setActivatorNodeRef} {...listeners} style={handleStyle}>⋮⋮</span>
//             <span>{x.name}</span>
//           </div>
//         )}
//       </SortableItem>
//     ))}
//   </SortableList>
//
// handleStyle にドラッグハンドルへの touch-action: none が含まれているので、
// ハンドル要素にこれを spread すれば、モバイルでスクロールとドラッグが
// 競合しない (ハンドル長押し中は端末スクロールしない)。
// 入力欄など他の領域は通常通りスクロールできる。

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
  // 200ms 押し続けないと drag が起動しない = 短いタップ・スクロールは通常動作のまま
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
    // autoScroll: ドラッグ中に viewport の上下端に近づくと自動でスクロールする。
    // threshold は viewport サイズに対する比率 (0.2 = 端から 20%)。
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      autoScroll={{
        threshold: { x: 0, y: 0.2 },
        acceleration: 10,
        interval: 5,
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * SortableItem は子要素に「ドラッグハンドルプロパティ」を渡す render-prop パターン。
 * children(handleProps) で受け取って、掴める領域 (アイコン) に spread する。
 *
 * handleStyle: { touchAction: "none" } を含むので、ハンドル要素にスタイルとして
 * 適用すること。これでモバイルブラウザの「ハンドル長押し中のスクロール」を抑止する。
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
    handleStyle: React.CSSProperties;
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

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    // 注: ここでは touch-action を設定しない。入力欄など他の領域は通常スクロールできる
  };

  // ハンドル要素に適用するスタイル: touch-action: none で「ここを掴んでいる間は
  // ブラウザ側のスクロール/ズームを起動させない」ようにする。
  const handleStyle: React.CSSProperties = {
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle}>
      {children({ listeners, setActivatorNodeRef, isDragging, handleStyle })}
    </div>
  );
}
