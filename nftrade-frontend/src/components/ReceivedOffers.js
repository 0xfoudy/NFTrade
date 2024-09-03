import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert, OverlayTrigger, Tooltip, Form } from 'react-bootstrap';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Add this enum at the top of your file, outside the component
const OfferStatus = {
  Pending: 0,
  Accepted: 1,
  Rejected: 2,
  Canceled: 3,
  Completed: 4
};

function ReceivedOffers({ contract, account, darkMode, nftContract }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleStatuses, setVisibleStatuses] = useState({
    [OfferStatus.Pending]: true,
    [OfferStatus.Accepted]: true,
    [OfferStatus.Rejected]: true,
    [OfferStatus.Canceled]: false,
    [OfferStatus.Completed]: false
  });

  useEffect(() => {
    if (contract && account) {
      fetchOffers();
    }
  }, [contract, account]);

  const fetchOffers = async () => {
    if (!contract || !account) return;
    setLoading(true);
    setError(null);
    try {
      const offerIds = await contract.viewReceivedOffers(account);
      console.log("Received offer IDs:", offerIds);

      const offerDetails = await Promise.all(offerIds.map(async (id) => {
        try {
          const offer = await contract.viewOffer(id);
          console.log(`Offer ${id}:`, offer);
          
          const [offeredNFTsMetadata, requestedNFTsMetadata] = await Promise.all([
            fetchNFTsMetadata(offer.offeredNFTs),
            fetchNFTsMetadata(offer.requestedNFTs)
          ]);

          // Handle different possible types of offerID
          let offerId;
          if (typeof offer.offerID === 'object' && offer.offerID.toNumber) {
            offerId = offer.offerID.toNumber();
          } else if (typeof offer.offerID === 'string') {
            offerId = parseInt(offer.offerID, 10);
          } else {
            offerId = Number(offer.offerID);
          }

          // Handle different possible types of status
          let status;
          if (typeof offer.status === 'object' && offer.status.toNumber) {
            status = offer.status.toNumber();
          } else if (typeof offer.status === 'string') {
            status = parseInt(offer.status, 10);
          } else {
            status = Number(offer.status);
          }

          console.log(`Offer ${id} status:`, status);

          return {
            id: offerId,
            from: offer.offerer,
            to: offer.offeree,
            offeredNFTs: offeredNFTsMetadata,
            offeredUSDC: offer.offeredUSDC,
            requestedNFTs: requestedNFTsMetadata,
            requestedUSDC: offer.requestedUSDC,
            status: status
          };
        } catch (error) {
          console.error(`Error fetching offer ${id}:`, error);
          return null;
        }
      }));

      const validOffers = offerDetails.filter(offer => offer !== null && offer.id !== 0);
      console.log("Valid fetched offer details:", validOffers);
      setOffers(validOffers);
    } catch (error) {
      console.error("Error fetching offers:", error);
      setError("Failed to fetch offers. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTsMetadata = async (nftIds) => {
    if (!nftContract) {
      console.warn('NFT contract is not initialized, using placeholder data');
      return nftIds.map(id => ({ id, name: `NFT ${id}`, image: '' }));
    }

    return Promise.all(nftIds.map(async (id) => {
      try {
        const tokenURI = await nftContract.tokenURI(id);
        console.log(`Token URI for NFT ${id}:`, tokenURI);
        const response = await fetch(tokenURI);
        const metadata = await response.json();
        console.log(`Metadata for NFT ${id}:`, metadata);
        return { id, name: metadata.name, image: metadata.image };
      } catch (error) {
        console.error(`Error fetching metadata for NFT ${id}:`, error);
        return { id, name: `NFT ${id}`, image: '' };
      }
    }));
  };

  const handleTransaction = async (action, offerId) => {
    let toastId;
    try {
      toastId = toast.loading('Sending transaction...', { autoClose: false });
      
      let tx;
      switch (action) {
        case 'accept':
          tx = await contract.acceptOffer(offerId);
          break;
        case 'reject':
          tx = await contract.rejectOffer(offerId);
          break;
        case 'finalize':
          tx = await contract.finalizeOffer(offerId);
          break;
        default:
          throw new Error('Invalid action');
      }

      const polygonscanUrl = `https://polygonscan.com/tx/${tx.hash}`;

      toast.update(toastId, { 
        render: "Transaction sent. Waiting for confirmation...", 
        type: "info", 
        isLoading: true 
      });

      await tx.wait();
      
      toast.update(toastId, { 
        render: (
          <div>
            Transaction successful!
            <br />
            <a href={polygonscanUrl} target="_blank" rel="noopener noreferrer">
              View on PolygonScan
            </a>
          </div>
        ), 
        type: "success",
        isLoading: false,
        autoClose: 5000
      });

      // Update the local state to reflect the change
      if (action === 'reject') {
        setOffers(prevOffers => prevOffers.filter(offer => offer.id !== offerId));
      } else {
        fetchOffers(); // Refresh all offers for accept and finalize actions
      }
    } catch (error) {
      console.error(`Error ${action}ing offer:`, error);
      toast.update(toastId, { 
        render: (
          <div>
            Error {action}ing offer: {error.message}
            <br />
            Check console for details.
          </div>
        ),
        type: "error",
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  const handleAcceptOffer = (offerId) => handleTransaction('accept', offerId);
  const handleRejectOffer = (offerId) => handleTransaction('reject', offerId);
  const handleFinalizeOffer = (offerId) => handleTransaction('finalize', offerId);

  const renderNFTBadges = (nfts, isOffered) => {
    return (
      <div className="mt-2">
        {nfts.map((nft) => (
          <OverlayTrigger
            key={nft.id}
            placement="top"
            overlay={
              <Tooltip id={`tooltip-${nft.id}`}>
                <img src={nft.image} alt={nft.name} style={{ maxWidth: '200px', maxHeight: '200px' }} />
              </Tooltip>
            }
          >
            <Badge 
              bg={isOffered ? "primary" : "success"} 
              className="me-2 mb-2"
            >
              {nft.name}
            </Badge>
          </OverlayTrigger>
        ))}
      </div>
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Address copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  };

  const renderOfferStatus = (status) => {
    console.log("Rendering status:", status);
    const statusMap = {
      [OfferStatus.Pending]: { text: "Pending", bg: "warning" },
      [OfferStatus.Accepted]: { text: "Accepted", bg: "success" },
      [OfferStatus.Rejected]: { text: "Rejected", bg: "danger" },
      [OfferStatus.Canceled]: { text: "Canceled", bg: "secondary" },
      [OfferStatus.Completed]: { text: "Completed", bg: "primary" }
    };

    const { text, bg } = statusMap[status] || { text: "Unknown", bg: "light" };
    return <Badge bg={bg}>{text}</Badge>;
  };

  const renderOfferActions = (offer) => {
    console.log(`Offer ${offer.id} status:`, offer.status, typeof offer.status);

    switch (Number(offer.status)) {
      case OfferStatus.Pending:
        return (
          <>
            <Button 
              variant="success" 
              onClick={() => handleAcceptOffer(offer.id)}
              className="me-2"
            >
              Accept
            </Button>
            <Button 
              variant="danger" 
              onClick={() => handleRejectOffer(offer.id)}
            >
              Reject
            </Button>
          </>
        );
      case OfferStatus.Accepted:
        return (
          <Button 
            variant="primary" 
            onClick={() => handleFinalizeOffer(offer.id)}
          >
            Finalize
          </Button>
        );
      default:
        return null;
    }
  };

  const handleAddressClick = (address) => {
    window.open(`https://courtyard.io/user/${address}`, '_blank');
  };

  const filteredOffers = offers.filter(offer => visibleStatuses[offer.status]);

  const toggleStatus = (status) => {
    setVisibleStatuses(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const renderStatusToggles = () => {
    const statusLabels = {
      [OfferStatus.Pending]: "Pending",
      [OfferStatus.Accepted]: "Accepted",
      [OfferStatus.Rejected]: "Rejected",
      [OfferStatus.Canceled]: "Canceled",
      [OfferStatus.Completed]: "Completed"
    };

    return (
      <div className="d-flex flex-wrap mb-3">
        {Object.entries(visibleStatuses).map(([status, isVisible]) => (
          <Form.Check 
            key={status}
            type="switch"
            id={`show-${statusLabels[status].toLowerCase()}-switch`}
            label={statusLabels[status]}
            checked={isVisible}
            onChange={() => toggleStatus(Number(status))}
            className="me-3 mb-2"
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div>Loading offers and NFT data...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <h2 className="section-title">Received Offers</h2>
      {renderStatusToggles()}
      {filteredOffers.length === 0 ? (
        <div>No offers to display.</div>
      ) : (
        filteredOffers.map((offer) => (
          <Card key={offer.id.toString()} className={`mb-3 ${darkMode ? 'text-white bg-dark' : ''}`}>
            <Card.Body>
              <Card.Title>Offer #{offer.id.toString()}</Card.Title>
              <div>
                <div>
                  <strong>From:</strong>{' '}
                  <Button 
                    variant="link" 
                    className="p-0"
                    onClick={() => handleAddressClick(offer.from)}
                  >
                    {offer.from}
                  </Button>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => copyToClipboard(offer.from)}
                    className="p-0 ms-2"
                  >
                    <i className="bi bi-clipboard" style={{ fontSize: '1rem' }}></i>
                  </Button>
                </div>
                <div>
                  <strong>To:</strong>{' '}
                  <Button 
                    variant="link" 
                    className="p-0"
                    onClick={() => handleAddressClick(offer.to)}
                  >
                    {offer.to}
                  </Button>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => copyToClipboard(offer.to)}
                    className="p-0 ms-2"
                  >
                    <i className="bi bi-clipboard" style={{ fontSize: '1rem' }}></i>
                  </Button>
                </div>
                <div className="p-3 rounded mb-3 bg-info bg-opacity-25">
                  <h5>You get:</h5>
                  <div>
                    <strong>NFTs ({offer.offeredNFTs.length}):</strong>
                    {renderNFTBadges(offer.offeredNFTs, true)}
                  </div>
                  <div>
                    <strong>USDC:</strong> {ethers.formatUnits(offer.offeredUSDC, 6)} USDC
                  </div>
                </div>
                <div className="p-3 rounded mb-3 bg-danger bg-opacity-25">
                  <h5>You give:</h5>
                  <div>
                    <strong>NFTs ({offer.requestedNFTs.length}):</strong>
                    {renderNFTBadges(offer.requestedNFTs, false)}
                  </div>
                  <div>
                    <strong>USDC:</strong> {ethers.formatUnits(offer.requestedUSDC, 6)} USDC
                  </div>
                </div>
                <div>
                  <strong>Status:</strong> {renderOfferStatus(offer.status)}
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                {renderOfferActions(offer)}
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}

export default ReceivedOffers;