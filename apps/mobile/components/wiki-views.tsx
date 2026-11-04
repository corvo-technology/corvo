import { ChatMarkdown } from "@corvo/chat-ui/native";
import type { WikiPage, WikiPageInfo } from "@corvo/contracts";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useResolvedAppearance, useThemedStyles } from "../lib/native";
import type { WikiGroup } from "../lib/wiki";
import { wikiDisplayBody } from "../lib/wiki";

type Row =
  | { type: "kind"; key: string; kind: string }
  | { type: "page"; key: string; page: WikiPageInfo };

/** The wiki's pages under their kind, each with the sentence that sums it up. */
export function WikiList({
  groups,
  onOpen,
}: {
  groups: WikiGroup[];
  onOpen: (title: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const rows = useMemo<Row[]>(
    () =>
      groups.flatMap((group) => [
        { type: "kind" as const, key: `kind:${group.kind}`, kind: group.kind },
        ...group.pages.map((page) => ({
          type: "page" as const,
          key: `page:${page.title}`,
          page,
        })),
      ]),
    [groups],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }) =>
        item.type === "kind" ? (
          <Text style={styles.kind}>{item.kind}</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen(item.page.title)}
            style={styles.row}
          >
            <Text style={styles.title} numberOfLines={1}>
              {item.page.title}
            </Text>
            {item.page.summary ? (
              <Text style={styles.summary} numberOfLines={1}>
                {item.page.summary}
              </Text>
            ) : null}
          </Pressable>
        )
      }
    />
  );
}

/** A page's text, with its links to other pages followable and the pages that cite it. */
export function WikiPageView({
  page,
  pages,
  onOpen,
}: {
  page: WikiPage;
  pages: readonly WikiPageInfo[];
  onOpen: (title: string) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const colorScheme = useResolvedAppearance();
  const body = useMemo(() => wikiDisplayBody(page.body, pages), [page.body, pages]);
  const renderMention = (id: string, name?: ReactNode) => (
    <Text style={styles.link} accessibilityRole="link" onPress={() => onOpen(id)}>
      {name ?? id}
    </Text>
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <ChatMarkdown
        palette={mobileTokens()}
        colorScheme={colorScheme}
        renderMention={renderMention}
      >
        {body}
      </ChatMarkdown>
      {page.backlinks.length ? (
        <View accessibilityLabel={t("Cited by")} style={styles.citedBy}>
          {page.backlinks.map((title) => (
            <Pressable key={title} accessibilityRole="button" onPress={() => onOpen(title)}>
              <Text style={styles.cite}>{title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    kind: {
      color: native.secondaryLabel,
      fontSize: 13,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 6,
    },
    row: { paddingHorizontal: 20, paddingVertical: 10, gap: 2 },
    title: { color: native.label, fontSize: 17 },
    summary: { color: native.secondaryLabel, fontSize: 14 },
    page: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
    link: { color: native.label, fontWeight: "600", textDecorationLine: "underline" },
    citedBy: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    cite: { color: native.secondaryLabel, fontSize: 14 },
  });
}
