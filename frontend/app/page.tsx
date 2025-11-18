//app/page.tsx

"use client";

import styles from "./page.module.css";
import MapSection from "@/components/MapSection";
import PinGrid from "@/components/PinGrid";
import TopSpots from "@/components/TopSpots";
import { PinStore, SavedPin } from "@/components/data/pinStore";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([]);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);

  // Load pins from Supabase on mount
  useEffect(() => {
    // First load from localStorage for immediate display
    const localPins = PinStore.all();
    setSavedPins(localPins);

    // Then load from Supabase and overwrite
    const loadRemotePins = async () => {
      try {
        const { data, error } = await supabase
          .from("pins")
          .select("*")
          .order("created_at", { ascending: false });

        if (error || !data) {
          if (error) console.error("Supabase pins fetch error:", error);
          return;
        }

        const remotePins: SavedPin[] = data.map((p: any) => ({
          id: p.id,
          area: p.area,
          lat: p.lat,
          lon: p.lon,
          activity: p.activity,
          createdAt: new Date(p.created_at).getTime(),
        }));

        setSavedPins(remotePins);
      } catch (err) {
        console.error("Unexpected error loading pins:", err);
      }
    };

    loadRemotePins();
  }, []);

  // Handler: Open pin detail page
  const handleOpen = (id: string) => {
    router.push(`/pins/${id}`);
  };

  // Handler: Edit pin
  const handleEdit = (id: string) => {
    router.push(`/pins/${id}/edit`);
  };

  // Handler: Delete pin
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this spot?")) return;

    try {
      const { error } = await supabase.from("pins").delete().eq("id", id);

      if (error) {
        console.error("Supabase delete error:", error);
        alert("Could not delete pin from database.");
        return;
      }

      // Also remove from localStorage
      PinStore.remove(id);

      // Update state
      setSavedPins((prev) => prev.filter((p) => p.id !== id));

      // Trigger map refresh to remove deleted pin
      setMapRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Unexpected error deleting pin:", err);
      alert("An error occurred while deleting the pin.");
    }
  };

  // Handler: Create new pin
  const handleCreate = () => {
    router.push("/map");
  };

  return (
    <main className={styles.pageContainer}>
      {/* Top: Pin Grid */}
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Your Spots</h2>
        <PinGrid
          pins={savedPins}
          onOpen={handleOpen}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      </section>

      {/* Map Section */}
      <section className={styles.sectionSpacing}>
        <MapSection refreshTrigger={mapRefreshTrigger} />
      </section>

      {/* Top Spots Today */}
      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>🏆 Top Spots Today</h2>
        <TopSpots />
      </section>
    </main>
  );
}
