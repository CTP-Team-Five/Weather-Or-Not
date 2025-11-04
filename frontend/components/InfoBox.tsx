"use client";
import styles from "./InfoBox.module.css";

interface InfoBoxProps {
  title: string;
  content: string;
  icon: React.ReactNode;
}

function InfoBox({ title, content, icon }: InfoBoxProps) {
  return (
    <div className={styles.card}>
      <div className={styles.infoHeader}>
        <div className={styles.infoIcon}>{icon}</div>
        <h4 className={styles.infoTitle}>{title}</h4>
      </div>
      <p className={styles.infoContent}>{content}</p>
    </div>
  );
}

export default InfoBox;
