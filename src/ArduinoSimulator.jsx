import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig } from 'avr8js';
import '@wokwi/elements';   

const ArduinoSimulator = () => {
  const [activeComponents, setActiveComponents] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('component'); // 'component' or 'code'
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [pinConfig, setPinConfig] = useState({ ledPin: 10, buttonPin: 2 });
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'properties'
  const [buttonPressed, setButtonPressed] = useState(false);
  const [ledStates, setLedStates] = useState({});
  const canvasRef = useRef(null);
  const componentIdCounter = useRef(0);
  const cpuRef = useRef(null);
  const portBRef = useRef(null);
  const portCRef = useRef(null);
  const portDRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const ledElementRef = useRef(null);
  const buttonElementRef = useRef(null);

  const componentTypes = [
    { type: 'arduino-uno', label: 'Arduino UNO', icon: '🔌' },
    { type: 'led', label: 'LED (Red)', icon: '💡' },
    { type: 'pushbutton', label: 'Push Button', icon: '🔘' }
  ];

  // Generate Arduino code based on pin configuration
  const generateArduinoCode = () => {
    const hasLED = activeComponents.some(comp => comp.type === 'led');
    const hasButton = activeComponents.some(comp => comp.type === 'pushbutton');

    let setupCode = 'void setup() {\n';
    let loopCode = '\nvoid loop() {\n';

    if (hasLED) {
      setupCode += `  pinMode(${pinConfig.ledPin}, OUTPUT);\n`;
    }

    if (hasButton) {
      setupCode += `  pinMode(${pinConfig.buttonPin}, INPUT_PULLUP);\n`;
    }

    setupCode += '}';

    if (hasLED && hasButton) {
      loopCode += `  digitalWrite(${pinConfig.ledPin}, digitalRead(${pinConfig.buttonPin}));\n`;
    } else if (hasLED) {
      loopCode += `  digitalWrite(${pinConfig.ledPin}, HIGH);\n`;
    } else if (hasButton) {
      loopCode += `  // Button on pin ${pinConfig.buttonPin}\n`;
    } else {
      loopCode += '  // Add your code here\n';
    }

    loopCode += '}';

    return setupCode + loopCode;
  };

  // LED is controlled by React state so it never “sticks” ON between runs
  // Update all LEDs ON/OFF
  const updateAllLEDStates = (isOn) => {
    setLedStates((prev) => {
      const newStates = {};
      activeComponents.forEach((comp) => {
        if (comp.type === 'led') newStates[comp.id] = Boolean(isOn);
      });
      return newStates;
    });
  };

  // Handle button press/release
  const handleButtonPress = (pressed) => {
    setButtonPressed(pressed);
    
    // Update button element state
    setTimeout(() => {
      const buttonElements = document.querySelectorAll('wokwi-pushbutton');
      buttonElements.forEach((buttonEl) => {
        buttonEl.setAttribute('pressed', pressed ? 'true' : 'false');
      });
    }, 0);
  };

  // Ensure all LEDs are always OFF when added before simulation
  useEffect(() => {
    const hasLED = activeComponents.some((comp) => comp.type === 'led');
    if (!isSimulating && hasLED) {
      updateAllLEDStates(false);
    }
  }, [activeComponents, isSimulating]);

  // Main simulation logic: all LEDs ON only during simulation
  useEffect(() => {
    const hasLED = activeComponents.some((comp) => comp.type === 'led');
    const hasButton = activeComponents.some((comp) => comp.type === 'pushbutton');

    if (!isSimulating) {
      // When simulation is stopped, ensure all LEDs are off and button state cleared
      updateAllLEDStates(false);
      setButtonPressed(false);
      return;
    }

    if (!hasLED) {
      updateAllLEDStates(false);
      return;
    }

    // Only turn ON LED if simulation is running AND button is present AND pressed
    if (hasButton && buttonPressed) {
      updateAllLEDStates(true);
    } else {
      updateAllLEDStates(false);
    }
  }, [isSimulating, buttonPressed, activeComponents]);

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
      setActiveComponents(prev => {
        // If adding an LED, initialize its state to OFF
        if (componentType === 'led') {
          setLedStates(states => ({ ...states, [newComponent.id]: false }));
        }
        return [...prev, newComponent];
      });
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

  const handleComponentClick = (component) => {
    // Only allow selection of LED and Push Button for pin configuration
    if (component.type === 'led' || component.type === 'pushbutton') {
      setSelectedComponent(component);
      setActiveTab('properties');
    }
  };

  const handlePinChange = (componentType, newPin) => {
    const pinNumber = parseInt(newPin);
    
    if (componentType === 'led') {
      setPinConfig({ ...pinConfig, ledPin: pinNumber });
    } else if (componentType === 'pushbutton') {
      setPinConfig({ ...pinConfig, buttonPin: pinNumber });
    }
  };

  // Get available pins for dropdown (D2-D13, excluding already assigned pins)
  const getAvailablePins = (componentType) => {
    const allPins = Array.from({ length: 12 }, (_, i) => i + 2); // Pins 2-13
    
    if (componentType === 'led') {
      // For LED: exclude buttonPin
      return allPins.filter(pin => pin !== pinConfig.buttonPin);
    } else if (componentType === 'pushbutton') {
      // For Button: exclude ledPin
      return allPins.filter(pin => pin !== pinConfig.ledPin);
    }
    return allPins;
  };

  const renderComponent = (component) => {
    const { type, x, y, id } = component;
    
    let element;
    let pinLabel = null;
    
    switch (type) {
      case 'arduino-uno':
        element = <wokwi-arduino-uno></wokwi-arduino-uno>;
        break;
      case 'led': {
        // Use per-LED state
        const ledValue = ledStates[id] ? 'true' : 'false';
        element = <wokwi-led color="red" value={ledValue}></wokwi-led>;
        pinLabel = `D${pinConfig.ledPin}`;
        break;
      }
      case 'pushbutton':
        element = (
          <wokwi-pushbutton
            onMouseDown={() => { handleButtonPress(true); setSelectedComponent(component); setActiveTab('properties'); }}
            onMouseUp={() => handleButtonPress(false)}
            onTouchStart={() => { handleButtonPress(true); setSelectedComponent(component); setActiveTab('properties'); }}
            onTouchEnd={() => handleButtonPress(false)}
          ></wokwi-pushbutton>
        );
        pinLabel = `D${pinConfig.buttonPin}`;
        break;
      default:
        return null;
    }

    const isSelected = selectedComponent?.id === id;

    return (
      <Draggable
        key={id}
        position={{ x, y }}
        onDrag={(e, data) => handleComponentDrag(id, e, data)}
        handle=".component-handle"
      >
        <div 
          className={`component-handle ${isSelected ? 'selected' : ''}`}
          style={{ position: 'absolute', cursor: 'move' }}
          onClick={(e) => {
            e.stopPropagation();
            handleComponentClick(component);
          }}
        >
          {element}
          {pinLabel && (
            <div className="pin-label" title={`Connected to Pin ${pinLabel}`}>
              {pinLabel}
            </div>
          )}
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
          {generateArduinoCode()}
        </SyntaxHighlighter>
      </div>
    );
  };

  const renderPropertiesPanel = () => {
    if (!selectedComponent) {
      return (
        <div className="properties-empty">
          <p>Click on an LED or Push Button component to configure its pin assignment.</p>
        </div>
      );
    }

    const { type } = selectedComponent;
    const availablePins = getAvailablePins(type);
    const currentPin = type === 'led' ? pinConfig.ledPin : pinConfig.buttonPin;

    return (
      <div className="properties-content">
        <div className="property-section">
          <h3 className="property-title">Component: {type === 'led' ? 'LED (Red)' : 'Push Button'}</h3>
        </div>
        
        <div className="property-section">
          <label className="property-label">Pin Selection</label>
          <select
            className="pin-select"
            value={currentPin}
            onChange={(e) => handlePinChange(type, e.target.value)}
          >
            {availablePins.map(pin => (
              <option key={pin} value={pin}>
                D{pin}
              </option>
            ))}
          </select>
          <p className="property-hint">
            {type === 'led' 
              ? `LED is connected to Digital Pin ${currentPin}. This pin cannot be used by the Push Button.`
              : `Push Button is connected to Digital Pin ${currentPin}. This pin cannot be used by the LED.`
            }
          </p>
        </div>

        <div className="property-section">
          <div className="pin-status">
            <strong>Current Pin Assignment:</strong>
            <span className="pin-badge">D{currentPin}</span>
          </div>
        </div>
      </div>
    );
  };

  // Start simulation and auto-select push button if present
  const handleStartSimulation = () => {
    setIsSimulating((prev) => {
      const next = !prev;
      if (!prev && next) { // simulation is starting
        // Try to select the push button if present
        const button = activeComponents.find(comp => comp.type === 'pushbutton');
        if (button) {
          setSelectedComponent(button);
          setActiveTab('properties');
        } else {
          setSelectedComponent(null);
        }
      } else if (prev && !next) {
        setSelectedComponent(null);
      }
      return next;
    });
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
            onClick={(e) => {
              // Deselect component when clicking on empty canvas
              if (e.target === e.currentTarget || e.target.classList.contains('canvas')) {
                setSelectedComponent(null);
              }
            }}
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
                onClick={handleStartSimulation}
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
              <button 
                className={`tab ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                CODE (ino)
              </button>
              <button 
                className={`tab ${activeTab === 'properties' ? 'active' : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                PROPERTIES
              </button>
            </div>
            <div className="panel-content">
              {activeTab === 'code' ? (
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
                  {generateArduinoCode()}
                </SyntaxHighlighter>
              ) : (
                renderPropertiesPanel()
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArduinoSimulator;
