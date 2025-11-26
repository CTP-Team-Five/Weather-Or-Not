"use client";
import styles from "./SuggestionCard.module.css";

interface SuggestionCardProps {
  title: string;
  isTitleCard?: boolean;
}

function SuggestionCard({ title, isTitleCard = false }: SuggestionCardProps) {
  if (isTitleCard) {
    return (
      <div className={`${styles.card} ${styles.titleCard}`}>
        <h2>{title}</h2>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.placeCard}`}>
      <h3 className={styles.placeCardH3}>{title}</h3>
      <p className={styles.placeCardP}>
        Discover hidden gems and local favorites near you.
      </p>
      <button className={styles.placeCardButton}>View Details →</button>
    </div>
  );
}

export default SuggestionCard;
