"use client";
import styles from "./MapSection.module.css";

function MapSection() {
  return (
    <div className={`${styles.card} ${styles.mapArea}`}>
      <div className={styles.mapText}>Map Section (Where Map Will Be)</div>
    </div>
  );
}

export default MapSection;
