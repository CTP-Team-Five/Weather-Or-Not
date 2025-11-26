import styles from "./InfoBox.module.css";

export default function InfoBox({ title, content, icon }: {
  title: string;
  content: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.infoHeader}>
        <div className={styles.infoIcon}>{icon}</div>
        <h3 className={styles.infoTitle}>{title}</h3>
      </div>
      <p className={styles.infoContent}>{content}</p>
    </div>
  );
}
