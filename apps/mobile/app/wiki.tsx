import type { WikiPageInfo } from "@corvo/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { WikiList } from "../components/wiki-views";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";
import { groupWikiPages, listWikiPages } from "../lib/wiki";

/** What the team knows, as pages the agents read and cite. Read only on a phone. */
export default function WikiScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [pages, setPages] = useState<WikiPageInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupWikiPages(pages ?? []), [pages]);

  const load = useCallback(async () => {
    try {
      setPages(await listWikiPages());
      setError(null);
    } catch (cause) {
      setError(errorText(cause, t("Could not load pages")));
    }
  }, [t]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (pages?.length)
    return (
      <WikiList
        groups={groups}
        onOpen={(title) => router.push({ pathname: "/wiki-page", params: { title } })}
      />
    );
  return (
    <View style={styles.empty}>
      {pages ? (
        <Text style={styles.message}>{t("No pages yet")}</Text>
      ) : error ? (
        <>
          <Text style={styles.message}>{error}</Text>
          <NativeActionButton
            label={t("Try Again")}
            variant="text"
            prominence="secondary"
            style={styles.retry}
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
    retry: { alignSelf: "center" },
  });
}
