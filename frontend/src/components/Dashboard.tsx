/**
 * Dashboard — the home page shown on app open.
 * Lays out the three Phase-1 widgets in a CSS grid:
 *   - WeatherWidget spans full width at the top
 *   - NewsWidget    bottom-left
 *   - BookmarksWidget bottom-right
 *
 * Each widget is completely self-contained. Removing one import here
 * is all it takes to drop a widget without touching anything else.
 */
import WeatherWidget    from "./widgets/WeatherWidget";
import NewsWidget       from "./widgets/NewsWidget";
import BookmarksWidget  from "./widgets/BookmarksWidget";

export default function Dashboard() {
  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="dash-weather">
          <WeatherWidget />
        </div>
        <div className="dash-news">
          <NewsWidget />
        </div>
        <div className="dash-bookmarks">
          <BookmarksWidget />
        </div>
      </div>
    </div>
  );
}
