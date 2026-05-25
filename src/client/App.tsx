import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  drainJobs,
  getAssetDetail,
  getQueueSummary,
  importSource,
  listAssets,
  listSources,
  retryFailed,
  type AssetDetailResponse
} from './api';
import { AssetDetail } from './components/AssetDetail';
import { AssetGrid } from './components/AssetGrid';
import { FilterBar } from './components/FilterBar';
import { Sidebar } from './components/Sidebar';
import type { Asset, LibrarySource, QueueSummary } from '../shared/types';

export default function App(): React.JSX.Element {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetDetail, setAssetDetail] = useState<AssetDetailResponse | null>(null);
  const [query, setQuery] = useState('');
  const [transcript, setTranscript] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rootPath, setRootPath] = useState('');
  const [sourceName, setSourceName] = useState('牛仔面料工厂');
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
  const assetRequestSeq = useRef(0);
  const selectedAssetIdRef = useRef<string | null>(null);

  const assetQuery = useMemo(
    () => ({
      tagNames: selectedTags,
      query: query.trim() || undefined,
      transcript: transcript.trim() || undefined
    }),
    [query, selectedTags, transcript]
  );

  const refreshSources = useCallback(async () => {
    setSources(await listSources());
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueueSummary(await getQueueSummary());
  }, []);

  const refreshAssets = useCallback(async (): Promise<string | null> => {
    const requestSeq = ++assetRequestSeq.current;
    setLoadingAssets(true);
    try {
      const nextAssets = await listAssets(assetQuery);
      if (requestSeq !== assetRequestSeq.current) return null;

      const nextSelectedAssetId = pickSelectedAssetId(selectedAssetIdRef.current, nextAssets);
      selectedAssetIdRef.current = nextSelectedAssetId;
      setAssets(nextAssets);
      setSelectedAssetId(nextSelectedAssetId);
      return nextSelectedAssetId;
    } finally {
      if (requestSeq === assetRequestSeq.current) {
        setLoadingAssets(false);
      }
    }
  }, [assetQuery]);

  const refreshAll = useCallback(async (): Promise<string | null> => {
    const requestSeq = ++assetRequestSeq.current;
    const [nextSources, nextAssets, nextQueue] = await Promise.all([
      listSources(),
      listAssets(assetQuery),
      getQueueSummary()
    ]);

    if (requestSeq !== assetRequestSeq.current) return null;

    const nextSelectedAssetId = pickSelectedAssetId(selectedAssetIdRef.current, nextAssets);
    selectedAssetIdRef.current = nextSelectedAssetId;
    setSources(nextSources);
    setAssets(nextAssets);
    setQueueSummary(nextQueue);
    setSelectedAssetId(nextSelectedAssetId);
    return nextSelectedAssetId;
  }, [assetQuery]);

  useEffect(() => {
    void runSafely(refreshAssets);
  }, [refreshAssets]);

  useEffect(() => {
    void runSafely(async () => {
      await Promise.all([refreshSources(), refreshQueue()]);
    });
  }, [refreshQueue, refreshSources]);

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetDetail(null);
      return;
    }

    let active = true;
    setLoadingDetail(true);
    getAssetDetail(selectedAssetId)
      .then((detail) => {
        if (active) {
          setAssetDetail(detail);
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setAssetDetail(null);
          setError(readErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingDetail(false);
        }
      });

    return () => {
      active = false;
    };
  }, [detailRefreshVersion, selectedAssetId]);

  async function runSafely(action: () => Promise<unknown>): Promise<void> {
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(readErrorMessage(caughtError));
    }
  }

  async function handleImport(): Promise<void> {
    await runAction(async () => {
      const result = await importSource(rootPath.trim(), sourceName.trim());
      setNotice(`已导入 ${result.indexed} 个素材，跳过 ${result.skipped} 个。`);
      await refreshAll();
      setDetailRefreshVersion((version) => version + 1);
    });
  }

  async function handleDrainJobs(): Promise<void> {
    await runAction(async () => {
      const result = await drainJobs(10);
      setNotice(`已处理 ${result.processed} 个任务。`);
      setQueueSummary(result.summary);
      await refreshAll();
      setDetailRefreshVersion((version) => version + 1);
    });
  }

  async function handleRetryFailed(): Promise<void> {
    await runAction(async () => {
      const result = await retryFailed();
      setNotice(`已重试 ${result.changed} 个失败任务。`);
      setQueueSummary(result.summary);
      await refreshAll();
      setDetailRefreshVersion((version) => version + 1);
    });
  }

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusyAction(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await Promise.all([refreshSources(), refreshQueue()]);
    } catch (caughtError) {
      setError(readErrorMessage(caughtError));
    } finally {
      setBusyAction(false);
    }
  }

  function toggleTag(tag: string): void {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag) ? currentTags.filter((currentTag) => currentTag !== tag) : [...currentTags, tag]
    );
  }

  return (
    <div className="appShell">
      <Sidebar
        sources={sources}
        rootPath={rootPath}
        sourceName={sourceName}
        busy={busyAction}
        onRootPathChange={setRootPath}
        onSourceNameChange={setSourceName}
        onImport={() => void handleImport()}
      />

      <main className="mainPanel">
        <FilterBar
          query={query}
          transcript={transcript}
          selectedTags={selectedTags}
          busy={busyAction}
          onQueryChange={setQuery}
          onTranscriptChange={setTranscript}
          onToggleTag={toggleTag}
          onRetryFailed={() => void handleRetryFailed()}
          onDrainJobs={() => void handleDrainJobs()}
        />

        {(notice || error) && (
          <div className={`noticeBar ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
            {error ?? notice}
          </div>
        )}

        <AssetGrid
          assets={assets}
          selectedAssetId={selectedAssetId}
          loading={loadingAssets}
          onSelectAsset={(assetId) => {
            selectedAssetIdRef.current = assetId;
            setSelectedAssetId(assetId);
          }}
        />
      </main>

      <AssetDetail detail={assetDetail} queueSummary={queueSummary} loading={loadingDetail} />
    </div>
  );
}

function pickSelectedAssetId(currentId: string | null, assets: Asset[]): string | null {
  if (currentId && assets.some((asset) => asset.id === currentId)) return currentId;
  return assets[0]?.id ?? null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const issuesText = Array.isArray(error.issues) ? ` (${error.issues.length} 个校验问题)` : '';
    return `${error.message}${issuesText}`;
  }

  if (error instanceof Error) return error.message;

  return '操作失败，请稍后重试。';
}
