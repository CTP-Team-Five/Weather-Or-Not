import styles from "./page.module.css";
import MapSection from "@/components/MapSection";
import SuggestionCard from "@/components/SuggestionCard";
import InfoBox from "@/components/InfoBox";
import PinIcon from "@/components/icons/PinIcon";
import SunIcon from "@/components/icons/SunIcon";

export default function Home() {
  return (
    <main className={styles.pageContainer}>
      <section className={styles.sectionSpacing}>
        <MapSection />
      </section>

      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Featured Destinations</h2>
        <div className={styles.suggestionGrid}>
          <SuggestionCard title="Top Places Today" isTitleCard />
          <SuggestionCard title="Place A: Bear Mountain Ski" />
          <SuggestionCard title="Place B: Crotona Park" />
          <SuggestionCard title="Place C: Red Bull Trail" />
        </div>
      </section>

      <section className={styles.sectionSpacing}>
        <h2 className={styles.mainHeading}>Your Dashboard</h2>
        <div className={styles.infoBoxGrid}>
          <InfoBox
            title="Saved Pins"
            content="5 recently pinned locations..."
            icon={<PinIcon />}
          />
          <InfoBox
            title="Upcoming Weather"
            content="Partly cloudy with a high of 75°F tomorrow."
            icon={<SunIcon />}
          />
        </div>
      </section>
    </main>
  );
}
