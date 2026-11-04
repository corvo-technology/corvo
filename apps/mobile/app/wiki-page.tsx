import type { WikiPage, WikiPageInfo } from "@corvo/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { WikiPageView } from "../components/wiki-views";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";
import { listWikiPages, readWikiPage } from "../lib/wiki";

/** One wiki page, with its links to other pages followable. */
export default function WikiPageScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { title = "" } = useLocalSearchParams<{ title?: string }>();
  const [loaded, setLoaded] = useState<{ page: WikiPage; pages: WikiPageInfo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [page, pages] = await Promise.all([readWikiPage(title), listWikiPages()]);
      setLoaded({ page, pages });
      setError(null);
    } catch (cause) {
      setError(errorText(cause, t("Could not load pages")));
    }
  }, [title, t]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loaded?.page.title === title)
    return (
      <WikiPageView
        page={loaded.page}
        pages={loaded.pages}
        onOpen={(next) => router.push({ pathname: "/wiki-page", params: { title: next } })}
      />
    );
  return (
    <View style={styles.empty}>
      {error ? (
        <>
          <Text style={styles.message}>{error}</Text>
          <NativeActionButton
            label={t("Try Again")}
            variant="text"
            prominence="secondary"
            onPress={() => void load()}
          />
        </>
      ) : (
        <ActivityIndicator color={native.secondaryLabel} />
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 8,
      backgroundColor: native.groupedPage,
    },
    message: { color: native.secondaryLabel, fontSize: 17, textAlign: "center" },
  });
}
