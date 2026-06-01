// Discovery popup — Variant B (name overlaid on hero photo).
// Rendered as a React tree; the host (DiscoveryLayer) mounts an instance
// into a Leaflet popup container via createRoot. Self-fetches Wikipedia
// enrichment on mount so the photo + summary populate without a parent
// having to thread async state through.

'use client';

import { useEffect, useState } from 'react';
import { HiOutlineBookmark, HiArrowRight } from 'react-icons/hi2';
import {
  ACTIVITY_COLOR,
  ACTIVITY_LABEL,
  friendlyTag,
  type DiscoveryResult,
} from './types';
import { fetchWikiEnrichment } from '@/lib/wikiEnrich';
import styles from './DiscoveryPopup.module.css';

interface Props {
  result:  DiscoveryResult;
  saved:   boolean;
  onSave:  () => void;
  onView:  () => void;       // called when saved → user wants to open report
}

export default function DiscoveryPopup({ result, saved, onSave, onView }: Props) {
  const accent = ACTIVITY_COLOR[result.activity];
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [articleTitle, setArticleTitle] = useState<string | undefined>();
  const [summary, setSummary] = useState<string | undefined>();
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [enrichTried, setEnrichTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!result.wikipedia) {
      setEnrichTried(true);
      return;
    }
    fetchWikiEnrichment(result.wikipedia).then((enr) => {
      if (cancelled) return;
      if (enr) {
        setPhotoUrl(enr.photoUrl);
        setArticleTitle(enr.title);
        setSummary(enr.summary);
      }
      setEnrichTried(true);
    });
    return () => { cancelled = true; };
  }, [result.wikipedia]);

  const showSkeleton = !enrichTried;

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        {showSkeleton && <div className={styles.heroSkeleton} aria-hidden />}
        {photoUrl && (
          <img
            className={`${styles.heroImg} ${photoLoaded ? styles.loaded : ''}`}
            src={photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={() => setPhotoLoaded(true)}
            onError={() => setPhotoUrl(undefined)}
          />
        )}
        {!showSkeleton && !photoUrl && (
          <div className={styles.heroFallback}>{friendlyTag(result.osmTag)}</div>
        )}
        <div className={styles.scrim} aria-hidden />

        <div className={styles.chipMount}>
          <span className={styles.chip}>
            <span
              className={styles.chipDot}
              style={{ background: accent }}
              aria-hidden
            />
            {ACTIVITY_LABEL[result.activity]}
          </span>
        </div>

        <div className={styles.overlayName}>
          <div className={styles.name}>{result.name}</div>
          <div className={styles.meta}>
            <span>{result.distanceKm.toFixed(1)} km</span>
            <span className={styles.metaSep}>·</span>
            <span>{friendlyTag(result.osmTag)}</span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {summary && <p className={styles.summary}>{summary}</p>}

        <div className={styles.ctaWrap}>
          {saved ? (
            <button
              type="button"
              className={styles.cta}
              style={{ background: '#0f172a' }}
              onClick={onView}
            >
              View report <HiArrowRight />
            </button>
          ) : (
            <button
              type="button"
              className={styles.cta}
              style={{ background: accent }}
              onClick={onSave}
            >
              <HiOutlineBookmark />
              Save spot to see score
            </button>
          )}
        </div>

        <div className={styles.foot}>
          {articleTitle ? (
            <>
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(articleTitle)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Photo: Wikipedia
              </a>
              <span className={styles.footSep}>·</span>
              <span>CC BY-SA</span>
            </>
          ) : (
            <span>Map: OSM</span>
          )}
          <span className={styles.footGrow} />
          <a
            href={`https://www.openstreetmap.org/${result.osmType}/${result.osmId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            OSM ↗
          </a>
        </div>
      </div>
    </div>
  );
}
