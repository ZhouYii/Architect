import { useDesignStore } from '../store';

export function Breadcrumb() {
  const breadcrumb = useDesignStore((s) => s.breadcrumb);
  const navigateTo = useDesignStore((s) => s.navigateTo);
  const currentPath = useDesignStore((s) => s.currentPath);

  return (
    <nav className="breadcrumb">
      {breadcrumb.map((item, i) => (
        <span key={item.canvasId} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep">&nbsp;/&nbsp;</span>}
          {item.canvasId === currentPath ? (
            <span className="breadcrumb-current">{item.label}</span>
          ) : (
            <button
              className="breadcrumb-link"
              onClick={() => navigateTo(item.canvasId)}
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
