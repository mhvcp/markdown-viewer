import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";

const STATUS_LABELS = { backlog: "Backlog", active: "Active", done: "Done" };
const ALL_STATUSES = ["backlog", "active", "done"];

export default function KanbanCard({ task, onEdit, onMove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const [showMover, setShowMover] = useState(false);

  const isOverdue =
    task.due && new Date(task.due) < new Date() && task.status !== "done";

  function handleMoveClick(e) {
    e.stopPropagation();
    setShowMover((v) => !v);
  }

  function handleMoveTo(e, status) {
    e.stopPropagation();
    setShowMover(false);
    if (onMove && status !== task.status) onMove(task.id, status);
  }

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={() => onEdit(task)}
      {...listeners}
      {...attributes}
    >
      <div className="kanban-card-desc">{task.description}</div>
      {task.details && (
        <div className="kanban-card-details">{task.details}</div>
      )}
      <div className="kanban-card-meta">
        {task.owner && <span className="kanban-card-owner">{task.owner}</span>}
        {task.due && (
          <span className={`kanban-card-due${isOverdue ? " overdue" : ""}`}>
            {isOverdue ? "Overdue: " : "Due: "}
            {task.due}
          </span>
        )}
        {task.source && (
          <span className="kanban-card-source">{task.source}</span>
        )}
        {task.boardLabel && (
          <span className="kanban-card-board">{task.boardLabel}</span>
        )}
        <button className="kanban-card-move-btn" onClick={handleMoveClick}>
          ⇄ Move
        </button>
      </div>
      {showMover && (
        <div className="kanban-card-mover" onClick={(e) => e.stopPropagation()}>
          {ALL_STATUSES.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              className="kanban-card-mover-btn"
              onClick={(e) => handleMoveTo(e, s)}
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
