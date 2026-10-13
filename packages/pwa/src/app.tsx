import { Shell } from "./layout";
import { resetDemoData } from "./kernel";
import { useRoute } from "./ui";
import { AccountingHome, Dashboard } from "./pages/home";
import { ChartOfAccounts, Journals } from "./pages/referentials";
import { Entries, NewEntry } from "./pages/entries";
import { Balance, GeneralLedger, JournalReport } from "./pages/reports";
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

function selectPage(route: string) {
  switch (route) {
    case "/":
      return <Dashboard />;
    case "/comptabilite":
      return <AccountingHome />;
    case "/comptabilite/plan":
      return <ChartOfAccounts />;
    case "/comptabilite/journaux":
      return <Journals />;
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
