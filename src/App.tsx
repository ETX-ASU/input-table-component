import Spreadsheet from "./components/spreadsheet";
import { useSimCapi } from "./hooks/useSimCapi";
import useSpreadsheetStore from "./lib/store";

export default function Home() {
  const { isLoading } = useSpreadsheetStore();
  useSimCapi();

  return (
    <main>
      {isLoading ? (
        <div className="mt-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      ) : (
        <Spreadsheet />
      )}
    </main>
  );
}
