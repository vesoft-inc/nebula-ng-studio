import { GraphStore } from '@studio/stores/graph/graph';
import { Theme } from '@mui/material';
import { NODE_SIZE } from '.';

export const generateFullGraphCanvas = ({
  graph,
  theme,
  callback,
}: {
  graph: GraphStore;
  theme: Theme;
  callback: (canvas: HTMLCanvasElement) => void;
}) => {
  if (!graph) return;
  if (!graph.twoGraph) return;

  const { instance, canvas: sourceCanvas } = graph.twoGraph;
  if (!sourceCanvas) return;

  if (!graph.nodes.size) {
    // If no nodes, create empty canvas
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 800;
    emptyCanvas.height = 600;
    const emptyCtx = emptyCanvas.getContext('2d');
    if (emptyCtx) {
      emptyCtx.fillStyle = theme.palette.vesoft.background.secondary;
      emptyCtx.fillRect(0, 0, 800, 600);
    }
    callback(emptyCanvas);
    return;
  }

  // Store original state to restore later
  const originalZoom = instance.zoom();
  const originalCenter = instance.centerAt();
  const originalWidth = instance.width();
  const originalHeight = instance.height();
  const restoreOriginalState = () => {
    instance.width(originalWidth);
    instance.height(originalHeight);
    instance.centerAt(originalCenter.x, originalCenter.y, 0);
    instance.zoom(originalZoom, 0);
  };

  try {
    // Calculate content bounds for high-resolution sizing
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };

    graph.nodes.forEach((node) => {
      const x = node.fx ?? node.x ?? 0;
      const y = node.fy ?? node.y ?? 0;
      const nodeSize = node.nodeArea ? Math.sqrt(node.nodeArea as number) : NODE_SIZE;
      const labelHeight = node.label ? 35 : 0;

      bounds.minX = Math.min(bounds.minX, x - nodeSize - 5);
      bounds.minY = Math.min(bounds.minY, y - nodeSize - 5);
      bounds.maxX = Math.max(bounds.maxX, x + nodeSize + 5);
      bounds.maxY = Math.max(bounds.maxY, y + nodeSize + labelHeight + 5);
    });

    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const padding = 50;
    const scaleFactor = 4; // High quality multiplier

    // Calculate high-resolution canvas size
    const aspectRatio = contentWidth / contentHeight;
    let exportWidth = (contentWidth + padding * 2) * scaleFactor;
    let exportHeight = (contentHeight + padding * 2) * scaleFactor;

    // Ensure minimum size for small graphs
    const minSize = 800 * scaleFactor;
    if (exportWidth < minSize) {
      exportWidth = minSize;
      exportHeight = minSize / aspectRatio;
    }
    if (exportHeight < minSize) {
      exportHeight = minSize;
      exportWidth = minSize * aspectRatio;
    }

    // Limit to 4K resolution (3840x2160)
    const maxWidth = 3840;
    const maxHeight = 2160;
    if (exportWidth > maxWidth || exportHeight > maxHeight) {
      const scaleDownRatio = Math.min(maxWidth / exportWidth, maxHeight / exportHeight);
      exportWidth = exportWidth * scaleDownRatio;
      exportHeight = exportHeight * scaleDownRatio;
    }

    // Temporarily resize the ForceGraph to high-resolution dimensions
    instance.width(exportWidth);
    instance.height(exportHeight);

    // Fit all content in the high-resolution canvas (like generateThumbnailCanvas)
    instance.zoomToFit(0);

    // Wait for the high-resolution render to complete
    setTimeout(() => {
      try {
        // Create the export canvas using the ACTUAL canvas dimensions (not calculated)
        // This is crucial - use sourceCanvas.width/height after resizing, not our calculated values
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = sourceCanvas.width;
        exportCanvas.height = sourceCanvas.height;
        const exportCtx = exportCanvas.getContext('2d');

        if (!exportCtx) {
          // Restore original state
          restoreOriginalState();
          console.error('Failed to get export canvas context');
          return;
        }

        // Set high quality rendering
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';

        // Fill background using actual canvas dimensions
        exportCtx.fillStyle = theme.palette.vesoft.background.secondary;
        exportCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);

        // Copy the high-resolution rendered canvas directly (just like generateThumbnailCanvas)
        exportCtx.drawImage(sourceCanvas, 0, 0);

        // Restore original ForceGraph state immediately
        restoreOriginalState();

        callback(exportCanvas);
      } catch (error) {
        console.error('Canvas generation error:', error);
        // Restore original state on error
        restoreOriginalState();
      }
    }, 200); // Give enough time for high-resolution render
  } catch (error) {
    console.error('Full graph export error:', error);
    // Restore original state on error
    restoreOriginalState();
  }
};
