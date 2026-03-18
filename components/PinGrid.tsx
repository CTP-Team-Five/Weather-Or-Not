// components/PinGrid.tsx

"use client";

import { useRouter } from "next/navigation";
import { SavedPin } from "./data/pinStore";
import { ComputedSuitability } from "@/lib/computeSuitability";
import PinTile from "./PinTile";
import styles from "./PinGrid.module.css";

type PinGridProps = {
  pins: SavedPin[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  computeResults?: Map<string, ComputedSuitability | null>;
  computeLoading?: boolean;
};

export default function PinGrid({ pins, onOpen, onEdit, onDelete, onCreate, computeResults, computeLoading }: PinGridProps) {
  const router = useRouter();

  const handleAddPin = () => {
    router.push("/map");
  };

  if (pins.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>No Saved Spots Yet</h3>
          <p>
            Start tracking your favorite outdoor locations.
            <br />
            Create your first pin to see live weather and session scores.
          </p>
          <button onClick={handleAddPin} className={`glassy ${styles.addButton}`}>
            + Create Your First Pin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {pins.map((pin, idx) => {
          const isFeatured = idx === 0 && pins.length >= 2;
          return (
            <PinTile
              key={pin.id}
              pin={pin}
              featured={isFeatured}
              className={isFeatured ? styles.featured : undefined}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              parentLoading={computeLoading ?? false}
              precomputed={computeResults?.has(pin.id) ? computeResults.get(pin.id) : undefined}
            />
          );
        })}

        {/* Ghost "Add new spot" card */}
        <button
          type="button"
          className={`${styles.tile} ${styles.addTile} glassy`}
          onClick={onCreate}
        >
          <div className={styles.addInner}>
            <span className={styles.addPlus}>＋</span>
            <span className={styles.addLabel}>Drop a new spot</span>
            <span className={styles.addHint}>Open the map and place another pin</span>
          </div>
        </button>
      </div>
    </div>
  );
}
