import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import '@wokwi/elements';

const ArduinoSimulator = () => {
  const [activeComponents, setActiveComponents] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('component'); // 'component' or 'code'
  const [draggedComponent, setDraggedComponent] = useState(null);
  const canvasRef = useRef(null);
  const componentIdCounter = useRef(0);

  const componentTypes = [
    { type: 'arduino-uno', label: 'Arduino UNO', icon: '🔌' },
    { type: 'led', label: 'LED (Red)', icon: '💡' },
    { type: 'pushbutton', label: 'Push Button', icon: '🔘' }
  ];

  const defaultArduinoCode = `void setup() {
  // Initialize your pins here
  pinMode(10, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  // Your main code logic here
  digitalWrite(10, digitalRead(2));
}`;

  const handleSidebarDragStart = (e, componentType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('componentType', componentType);
    setDraggedComponent(componentType);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const componentType = e.dataTransfer.getData('componentType');
    if (!componentType) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if dropped within canvas bounds
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      const newComponent = {
        id: componentIdCounter.current++,
        type: componentType,
        x: x - 50, // Center the component
        y: y - 50
      };
      setActiveComponents([...activeComponents, newComponent]);
    }
    setDraggedComponent(null);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleComponentDrag = (id, e, data) => {
    setActiveComponents(components =>
      components.map(comp =>
        comp.id === id ? { ...comp, x: data.x, y: data.y } : comp
      )
    );
  };

  const renderComponent = (component) => {
    const { type, x, y, id } = component;
    
    let element;
    switch (type) {
      case 'arduino-uno':
        element = <wokwi-arduino-uno></wokwi-arduino-uno>;
        break;
      case 'led':
        element = <wokwi-led color="red"></wokwi-led>;
        break;
      case 'pushbutton':
        element = <wokwi-pushbutton></wokwi-pushbutton>;
        break;
      default:
        return null;
    }

    return (
      <Draggable
        key={id}
        position={{ x, y }}
        onDrag={(e, data) => handleComponentDrag(id, e, data)}
        handle=".component-handle"
      >
        <div className="component-handle" style={{ position: 'absolute', cursor: 'move' }}>
          {element}
        </div>
      </Draggable>
    );
  };

  const renderCodeView = () => {
    return (
      <div className="code-view-container">
        <SyntaxHighlighter
          language="cpp"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '20px',
            borderRadius: '8px',
            height: '100%',
            overflow: 'auto'
          }}
        >
          {defaultArduinoCode}
        </SyntaxHighlighter>
      </div>
    );
  };

  return (
    <div className="arduino-simulator">
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="app-title">Arduino Simulator</h1>
        </div>
        <div className="toolbar-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'component' ? 'active' : ''}`}
              onClick={() => setViewMode('component')}
            >
              Component View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setViewMode('code')}
            >
              Code View
            </button>
          </div>
        </div>
      </div>

      <div className="main-container">
        {/* Left Sidebar - Components */}
        {viewMode === 'component' && (
          <div className="sidebar">
            <h2 className="sidebar-title">Components</h2>
            <div className="component-list">
              {componentTypes.map((comp) => (
                <div
                  key={comp.type}
                  className="component-item"
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, comp.type)}
                >
                  <div className="component-icon">{comp.icon}</div>
                  <span className="component-label">{comp.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center Canvas */}
        <div className="canvas-container">
          <div
            ref={canvasRef}
            className={`canvas ${isSimulating ? 'simulating' : ''}`}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            {viewMode === 'component' && activeComponents.map(renderComponent)}
            {viewMode === 'component' && activeComponents.length === 0 && (
              <div className="empty-canvas-message">
                Drag components from the sidebar to start building your circuit
              </div>
            )}
            {viewMode === 'code' && renderCodeView()}
          </div>

          {/* Simulation Controls */}
          {viewMode === 'component' && (
            <div className="simulation-controls">
              <button
                className={`simulation-btn ${isSimulating ? 'stop' : 'start'}`}
                onClick={() => setIsSimulating(!isSimulating)}
              >
                {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Code/Properties */}
        {viewMode === 'component' && (
          <div className="right-panel">
            <div className="panel-tabs">
              <button className="tab active">CODE (ino)</button>
              <button className="tab">PROPERTIES</button>
            </div>
            <div className="panel-content">
              <SyntaxHighlighter
                language="cpp"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '15px',
                  borderRadius: '0',
                  fontSize: '14px'
                }}
              >
                {defaultArduinoCode}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArduinoSimulator;
