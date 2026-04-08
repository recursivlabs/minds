import { TabBar } from './TabBar';

type FeedTab = 'foryou' | 'latest' | 'following' | 'trending';

interface Props {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}

const TABS = [
  { key: 'foryou', label: 'For You' },
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
  { key: 'following', label: 'Following' },
];

export function FeedTabs({ active, onChange }: Props) {
  return <TabBar tabs={TABS} active={active} onChange={(k) => onChange(k as FeedTab)} />;
}
