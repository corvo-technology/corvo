import type { WikiChange, WikiPageInfo } from "@corvo/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { WikiChangeCard, WikiList } from "../components/wiki-views";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";
import { decideWikiChange, groupWikiPages, listWikiChanges, listWikiPages } from "../lib/wiki";

/** What the team knows, as pages the agents read and cite. Read only on a phone. */
export default function WikiScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [pages, setPages] = useState<WikiPageInfo[] | null>(null);
  const [waiting, setWaiting] = useState<WikiChange[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupWikiPages(pages ?? []), [pages]);

  const load = useCallback(async () => {
    try {
      setPages(await listWikiPages());
      // What waits is a courtesy on top of the pages: not being able to read it hides it, no more.
      setWaiting(await listWikiChanges(["pending"]).catch(() => []));
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

  const open = (title: string) => router.push({ pathname: "/wiki-page", params: { title } });
  async function decide(changeId: string, decision: "apply" | "refuse" | "undo") {
    if (deciding) return;
    setDeciding(changeId);
    try {
      await decideWikiChange(changeId, decision);
      await load();
    } catch {
      // Someone may have answered first: what is on screen is what the server says now.
      await load();
    } finally {
      setDeciding(null);
    }
  }

  if (pages?.length || waiting.length)
    return (
      <WikiList
        groups={groups}
        onOpen={open}
        header={waiting.map((change) => (
          <WikiChangeCard
            key={change.id}
            change={change}
            busy={deciding === change.id}
            onDecide={(decision) => void decide(change.id, decision)}
            onOpenPage={open}
          />
        ))}
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
