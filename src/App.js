import { BrowserRouter } from 'react-router-dom';
import SinhalaResponseSystem from './SinhalaResponseSystem';

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
