import { BrowserRouter } from 'react-router-dom';
import SinhalaResponseSystem from './SinhalaVoiceResponseSystem';
import'./App.css'; // Assuming you have some styles in App.css
function App() {
  return (
    <BrowserRouter basename="/Signify">
  <div className="App">
      <SinhalaResponseSystem />
    </div>
    </BrowserRouter>
  );
}

export default App;
