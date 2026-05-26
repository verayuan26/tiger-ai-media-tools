import { useState, useMemo } from 'react';
import { FilterBar } from '../components/FilterBar';
import { AssetGrid } from '../components/AssetGrid';
import { mockAssets } from '../mock-data';

export function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  const filteredAssets = useMemo(() => {
    let filtered = mockAssets;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset.fileName.toLowerCase().includes(query) ||
          asset.tags.some((tag) => tag.name.toLowerCase().includes(query)) ||
          asset.transcripts?.some((t) =>
            t.text.toLowerCase().includes(query) ||
            t.translation?.toLowerCase().includes(query)
          )
      );
    }

    if (selectedFileTypes.length > 0) {
      filtered = filtered.filter((asset) =>
        selectedFileTypes.includes(asset.fileType)
      );
    }

    if (selectedLanguages.length > 0) {
      filtered = filtered.filter((asset) =>
        asset.tags.some((tag) => selectedLanguages.includes(tag.name))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((asset) =>
        selectedTags.every((selectedTag) =>
          asset.tags.some((tag) => tag.name === selectedTag)
        )
      );
    }

    return filtered;
  }, [searchQuery, selectedFileTypes, selectedLanguages, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleFileType = (type: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  return (
    <>
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        selectedFileTypes={selectedFileTypes}
        onToggleFileType={toggleFileType}
        selectedLanguages={selectedLanguages}
        onToggleLanguage={toggleLanguage}
      />

      <AssetGrid
        assets={filteredAssets}
      />
    </>
  );
}
