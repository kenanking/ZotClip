/**
 * Notifier "item"/"add" fires for RSS feed refreshes too. Skip feed-library items
 * so "auto-tag on add" only runs for normal library additions.
 */
export function isItemEligibleForAutoTagOnAdd(item: {
  isRegularItem(): boolean;
  isFeedItem: boolean;
}): boolean {
  return item.isRegularItem() && !item.isFeedItem;
}
