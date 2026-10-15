import { Shell } from "./layout";
import { resetDemoData } from "./kernel";
import { useRoute } from "./ui";
import { AccountingHome } from "./pages/home";
import { Opening } from "./pages/opening";
import { ChartOfAccounts, Journals } from "./pages/referentials";
import { EditEntry, Entries, NewEntry } from "./pages/entries";
import { Balance, GeneralLedger, JournalReport } from "./pages/reports";
import { ThirdParties } from "./pages/third-parties";
import { AuditLog } from "./pages/audit";
import { Editions } from "./pages/editions";
import { Society } from "./pages/society";
import { Periods } from "./pages/periods";

export function App() {
  const route = useRoute();

  const handleReset = async () => {
    if (!window.confirm("Effacer les données locales de démonstration de ce navigateur ?")) {
      return;
    }
    await resetDemoData();
    window.location.reload();
  };

  return <Shell onReset={handleReset}>{selectPage(route)}</Shell>;
}

/** Route de révision d'un brouillon : `/comptabilite/pieces/{id}/modifier`. */
const EDIT_ROUTE = /^\/comptabilite\/pieces\/([^/]+)\/modifier$/;

function selectPage(route: string) {
  const edit = EDIT_ROUTE.exec(route);
  if (edit && edit[1] !== "nouvelle") {
    return <EditEntry entryId={edit[1]!} />;
  }

  switch (route) {
    case "/":
      return <Opening />;
    case "/comptabilite":
      return <AccountingHome />;
    case "/comptabilite/plan":
      return <ChartOfAccounts />;
    case "/comptabilite/journaux":
      return <Journals />;
    case "/comptabilite/tiers":
      return <ThirdParties />;
    case "/comptabilite/pieces":
      return <Entries />;
    case "/comptabilite/pieces/nouvelle":
      return <NewEntry />;
    case "/comptabilite/balance":
      return <Balance />;
    case "/comptabilite/etats/journal":
      return <JournalReport />;
    case "/comptabilite/etats/grand-livre":
      return <GeneralLedger />;
    case "/comptabilite/periodes":
      return <Periods />;
    case "/comptabilite/audit":
      return <AuditLog />;
    case "/comptabilite/editions":
      return <Editions />;
    case "/parametres/societe":
      return <Society />;
    default:
      return (
        <section class="empty-state">
          <span class="eyebrow">Navigation</span>
          <h1>Page introuvable</h1>
          <p>Cette fonction n'existe pas encore ou son adresse a changé.</p>
        </section>
      );
  }
}
