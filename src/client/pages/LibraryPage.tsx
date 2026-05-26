import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, listAssets } from '../api';
import { LibraryAssetGrid } from '../components/library/AssetGrid';
import { LibraryFilterBar } from '../components/library/FilterBar';
import type { AssetListItem, MediaKind } from '../../shared/types';
import { toast } from 'sonner';

export function LibraryPage(): React.JSX.Element {
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const requestSeq = useRef(0);

  const serverQuery = useMemo(
    () => ({
      tagNames: [...selectedTags, ...selectedLanguages],
      query: searchQuery.trim() || undefined
    }),
    [searchQuery, selectedLanguages, selectedTags]
  );

  const filteredAssets = useMemo(() => {
    if (selectedFileTypes.length === 0) return assets;

    const allowedKinds = new Set(selectedFileTypes as MediaKind[]);
    return assets.filter((asset) => allowedKinds.has(asset.kind));
  }, [assets, selectedFileTypes]);

  const refreshAssets = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const nextAssets = await listAssets(serverQuery);
      if (seq !== requestSeq.current) return;
      setAssets(nextAssets);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      toast.error(readErrorMessage(error));
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [serverQuery]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  function toggleTag(tag: string): void {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
    );
  }

  function toggleFileType(type: string): void {
    setSelectedFileTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
    );
  }

  function toggleLanguage(lang: string): void {
    setSelectedLanguages((current) =>
      current.includes(lang) ? current.filter((value) => value !== lang) : [...current, lang]
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <LibraryFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        selectedFileTypes={selectedFileTypes}
        onToggleFileType={toggleFileType}
        selectedLanguages={selectedLanguages}
        onToggleLanguage={toggleLanguage}
      />
      <LibraryAssetGrid assets={filteredAssets} loading={loading} />
    </div>
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '加载素材失败，请稍后重试。';
}
