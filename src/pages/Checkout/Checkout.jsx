import { useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../apiConfig'; // Import the centralized config

const MACHINE_ID = "vending-machine-01";

const Checkout = () => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRedeemCode = (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      Swal.fire('Invalid Code', 'Please enter a valid 6-digit code.', 'error');
      return;
    }

    setIsLoading(true);

    fetch(`${API_BASE_URL}/api/dispense-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispenseCode: code, deviceId: MACHINE_ID }),
    })
      .then(res => res.json())
      .then(data => {
        setIsLoading(false);
        if (data.message.includes('Success')) {
          Swal.fire('Success!', 'Your product is being dispensed. Thank you!', 'success');
          setCode(''); // Clear the input field
        } else {
          Swal.fire('Error', data.message || 'An unknown error occurred.', 'error');
        }
      })
      .catch(err => {
        setIsLoading(false);
        console.error("Error redeeming code:", err);
        Swal.fire('Server Error', 'Could not connect to the server to redeem your code.', 'error');
      });
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Enter Your Code</h2>
      <form onSubmit={handleRedeemCode}>
        <div className="mb-4">
          <label htmlFor="code-input" className="block text-gray-700 text-sm font-bold mb-2">
            Dispense Code
          </label>
          <input
            id="code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength="6"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400"
        >
          {isLoading ? 'Verifying...' : 'Get My Product'}
        </button>
      </form>
    </div>
  );
};

export default Checkout;