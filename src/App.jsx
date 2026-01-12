import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import './App.css';
import { API_BASE_URL } from './apiConfig';

const DEVICE_ID = "vending-machine-01"; // Static device ID for this frontend

function App() {
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState({ bKashNumber: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [dispenseCode, setDispenseCode] = useState('');
  const [pollingOrderId, setPollingOrderId] = useState(null);
  
  const pollingIntervalRef = useRef(null);

  // --- Effects ---

  // Fetch products and config from the server on component load
  useEffect(() => {
    // Fetch Products
    fetch(`${API_BASE_URL}/api/products`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => {
        console.error("Error fetching products:", err);
        Swal.fire('Connection Error', 'Could not fetch products from the server.', 'error');
      });

    // Fetch Config
    fetch(`${API_BASE_URL}/api/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => {
        console.error("Error fetching config:", err);
      });
  }, []);

  // Polling effect for cash orders
  useEffect(() => {
    if (pollingOrderId) {
      pollingIntervalRef.current = setInterval(() => {
        fetch(`${API_BASE_URL}/api/order-status/${pollingOrderId}`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'paid') {
              clearInterval(pollingIntervalRef.current);
              setPollingOrderId(null);
              Swal.fire('Payment Successful!', 'Your product is being dispensed.', 'success');
            } else if (data.status === 'failed') {
              clearInterval(pollingIntervalRef.current);
              setPollingOrderId(null);
              Swal.fire('Payment Failed', data.failureReason || 'The machine could not verify your payment.', 'error');
            }
            // If status is 'pending', do nothing and let it poll again.
          })
          .catch(err => {
            console.error("Polling error:", err);
            clearInterval(pollingIntervalRef.current);
            setPollingOrderId(null);
            Swal.fire('Connection Error', 'Lost connection while checking payment status.', 'error');
          });
      }, 3000); // Poll every 3 seconds
    }

    // Cleanup function to clear interval when component unmounts or polling stops
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollingOrderId]);


  // --- User Actions ---

  // Step 1: User clicks "Purchase" on a product
  const handlePurchaseClick = (product) => {
    Swal.fire({
      title: `Confirm Your Order`,
      html: `
        <p>You selected: <strong>${product.name}</strong></p>
        <p>Price: <strong>${product.price.toFixed(2)} Taka</strong></p>
        <p>How would you like to pay?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Pay with bKash',
      cancelButtonText: 'Pay with Cash',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        createOrder(product, 'bKash');
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        createOrder(product, 'cash');
      }
    });
  };

  // Step 2: Create the order on the backend
  const createOrder = (product, paymentMethod) => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.productId,
        deviceId: DEVICE_ID,
        paymentMethod: paymentMethod
      }),
    })
    .then(res => res.json())
    .then(data => {
      setIsLoading(false);
      if (data.orderId) {
        if (paymentMethod === 'bKash') {
          promptForBKashPayment(product);
        } else if (paymentMethod === 'cash') {
          promptForCashInsertion(product, data.orderId);
          setPollingOrderId(data.orderId); // Start polling for cash payment status
        }
      } else {
        Swal.fire('Error', data.message || 'Could not create the order.', 'error');
      }
    })
    .catch(err => {
      setIsLoading(false);
      console.error("Error creating order:", err);
      Swal.fire('Server Error', 'Could not connect to the server.', 'error');
    });
  };

  // Step 3a: Show bKash instructions
  const promptForBKashPayment = (product) => {
    const bKashNumber = config.bKashNumber ? `<b>${config.bKashNumber}</b>` : 'the number provided by the machine';
    Swal.fire({
      title: 'Pay with bKash',
      html: `To get your dispense code, please pay <b>exactly ${product.price.toFixed(2)} Taka</b> to bKash number ${bKashNumber}.<br/><br/>Your code will be sent via SMS automatically after payment is detected.`,
      icon: 'info',
      confirmButtonText: 'Got It!'
    });
  };

  // Step 3b: Show Cash instructions
  const promptForCashInsertion = (product, orderId) => {
    Swal.fire({
      title: 'Pay with Cash',
      html: `
        <p>Your order (ID: ${orderId}) has been created.</p>
        <p>Please use the <strong>VendingCam mobile app</strong> to submit a photo of your <strong>${product.price.toFixed(2)} Taka</strong> note.</p>
        <br>
        <p>This screen will update automatically once your payment is verified.</p>
      `,
      icon: 'info',
      confirmButtonText: 'Awesome!'
    });
  };

  // Final Step: User submits their dispense code
  const handleDispenseSubmit = (e) => {
    e.preventDefault();
    if (!dispenseCode || dispenseCode.length !== 6) {
        Swal.fire('Invalid Code', 'Please enter a valid 6-digit dispense code.', 'warning');
        return;
    }
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/dispense-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispenseCode, deviceId: DEVICE_ID }),
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
        if (ok) {
            Swal.fire('Success!', data.message, 'success');
        } else {
            Swal.fire('Error', data.message || 'An unknown error occurred.', 'error');
        }
        setIsLoading(false);
        setDispenseCode('');
    })
    .catch(err => {
        setIsLoading(false);
        console.error("Error dispensing product:", err);
        Swal.fire('Server Error', 'Could not connect to the server to dispense the product.', 'error');
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Vending Machine</h1>
        <p className="text-lg text-gray-600">Select a product to purchase</p>
      </div>

      {products.length === 0 && !isLoading ? (
        <p className="text-center text-gray-500">Loading products...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(product => (
            <div key={product.productId} className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform">
              <img src={`/assets/${product.image}`} alt={product.name} className="w-full h-48 object-cover"/>
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                <p className="text-gray-700 font-bold text-2xl mt-2">{product.price.toFixed(2)} Taka</p>
                <button
                  onClick={() => handlePurchaseClick(product)}
                  disabled={isLoading}
                  className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {isLoading ? 'Processing...' : 'Purchase'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-12 p-6 bg-gray-100 rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Have a Dispense Code?</h2>
        <form onSubmit={handleDispenseSubmit} className="flex flex-col items-center max-w-sm mx-auto">
            <input
                type="text"
                value={dispenseCode}
                onChange={(e) => setDispenseCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength="6"
                className="p-3 w-full text-center text-2xl font-mono border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
            />
            <button
                type="submit"
                disabled={isLoading || !dispenseCode}
                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400"
            >
                {isLoading ? 'Verifying...' : 'Dispense My Product'}
            </button>
        </form>
      </div>
    </div>
  );
}

export default App;
