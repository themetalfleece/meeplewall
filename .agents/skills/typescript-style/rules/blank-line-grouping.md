---
title: Separate logical pieces with a blank line
tags: readability, formatting
---

## Separate logical pieces of a function body with a blank line

A hook or function that reads several sources, then derives, then returns, puts a blank line between those pieces. The reader then sees the shape of the body before reading it.

Put one around any multi-line call as well: a `useQuery`, a `useMemo`, a long object literal.

Inside a branchy callback, separate each guard clause from the next.

A body that is one short thought stays as one block.

**Incorrect:**

```ts
export function useRelatedPosts(post: Post | null) {
  const { data: tags } = useTags();
  const locale = useLocale();
  const related = useQuery({
    queryKey: ["related-posts", post?.slug],
    queryFn: ({ signal }) => fetchRelated(post, { signal }),
    enabled: post !== null,
  });
  if (!post) return null;
  if (!tags) return null;
  return new RelatedPosts({ posts: related.data, tags, locale });
}
```

**Correct:**

```ts
export function useRelatedPosts(post: Post | null) {
  const { data: tags } = useTags();
  const locale = useLocale();

  const related = useQuery({
    queryKey: ["related-posts", post?.slug],
    queryFn: ({ signal }) => fetchRelated(post, { signal }),
    enabled: post !== null,
  });

  if (!post) return null;

  if (!tags) return null;

  return new RelatedPosts({ posts: related.data, tags, locale });
}
```
