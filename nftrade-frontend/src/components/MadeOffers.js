import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert, OverlayTrigger, Tooltip, Form, Modal } from 'react-bootstrap';
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

function MadeOffers({ contract, account, darkMode, nftContract, usdcContract, provider }) {
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
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalItems, setApprovalItems] = useState([]);

  useEffect(() => {
    if (contract && account) {
      fetchOffers();
    }
  }, [contract, account]);

  useEffect(() => {
  }, [contract, nftContract, usdcContract]);

  const fetchOffers = async () => {
    if (!contract || !account) return;
    setLoading(true);
    setError(null);
    try {
      const offerIds = await contract.viewOfferedOffers(account);
      console.log("Made offer IDs:", offerIds);

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

  const handleCancelOffer = async (offerId) => {
    let toastId;
    try {
      toastId = toast.loading('Sending transaction...', { autoClose: false });
      
      const tx = await contract.cancelOfferedOffer(offerId);

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
      setOffers(prevOffers => prevOffers.map(offer => 
        offer.id === offerId ? { ...offer, status: OfferStatus.Canceled } : offer
      ));
    } catch (error) {
      console.error(`Error cancelling offer:`, error);
      toast.update(toastId, { 
        render: (
          <div>
            Error cancelling offer: {error.message}
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

  const handleAddressClick = (address) => {
    window.open(`https://courtyard.io/user/${address}`, '_blank');
  };

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

  const renderOfferSection = (title, nfts, usdc, isOffered) => {
    const bgColor = isOffered ? 'bg-danger bg-opacity-25' : 'bg-info bg-opacity-25';
    return (
      <div className={`p-3 rounded mb-3 ${bgColor}`}>
        <h5>{title}</h5>
        <div>
          <strong>NFTs ({nfts.length}):</strong>
          {renderNFTBadges(nfts, isOffered)}
        </div>
        <div>
          <strong>USDC:</strong> {ethers.formatUnits(usdc, 6)} USDC
        </div>
      </div>
    );
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

  const checkAndUpdateApprovals = async (offer) => {
    let toastId;
    try {
      toastId = toast.loading('Checking approvals...', { autoClose: false });

      const signer = await provider.getSigner(account);
      const nftContractWithSigner = nftContract.connect(signer);
      const usdcContractWithSigner = usdcContract.connect(signer);

      // Check and approve NFTs if necessary
      for (const nft of offer.offeredNFTs) {
        const approvedAddress = await nftContractWithSigner.getApproved(nft.id);
        if (approvedAddress.toLowerCase() !== contract.target.toLowerCase()) {
          toast.update(toastId, { 
            render: `Approving NFT: ${nft.name}...`, 
            type: "info", 
            isLoading: true 
          });
          const approvalTx = await nftContractWithSigner.approve(contract.target, nft.id);
          await approvalTx.wait();
        }
      }

      // Check and approve USDC if necessary
      let offeredUSDC = ethers.getBigInt(offer.offeredUSDC.toString());
      if (offeredUSDC > 0n) {
        const allowance = await usdcContractWithSigner.allowance(account, contract.target);
        if (allowance < offeredUSDC) {
          const usdcAmount = ethers.formatUnits(offeredUSDC, 6);
          toast.update(toastId, { 
            render: `Approving ${usdcAmount} USDC...`, 
            type: "info", 
            isLoading: true 
          });
          const usdcApprovalTx = await usdcContractWithSigner.approve(contract.target, offeredUSDC);
          await usdcApprovalTx.wait();
        }
      }

      toast.update(toastId, { 
        render: "All necessary approvals are in place!",
        type: "success",
        isLoading: false,
        autoClose: 3000
      });
    } catch (error) {
      console.error('Error checking and updating approvals:', error);
      toast.update(toastId, { 
        render: `Error: ${error.message}. Check console for details.`,
        type: "error",
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  const handleSealDeal = async (offerId) => {
    let toastId;
    try {
      toastId = toast.loading('Checking approvals...', { autoClose: false });

      const offer = offers.find(o => o.id === offerId);
      if (!offer) throw new Error('Offer not found');

      const signer = await provider.getSigner(account);
      const nftContractWithSigner = nftContract.connect(signer);
      const usdcContractWithSigner = usdcContract.connect(signer);

      const itemsNeedingApproval = [];

      // Check approvals for the current user (offerer)
      for (const nft of offer.offeredNFTs) {
        const approvedAddress = await nftContractWithSigner.getApproved(nft.id);
        if (approvedAddress.toLowerCase() !== contract.target.toLowerCase()) {
          itemsNeedingApproval.push({ type: 'NFT', id: nft.id, name: nft.name });
        }
      }

      if (offer.offeredUSDC > 0n) {
        const allowance = await usdcContractWithSigner.allowance(account, contract.target);
        if (allowance < offer.offeredUSDC) {
          itemsNeedingApproval.push({ type: 'USDC', amount: offer.offeredUSDC });
        }
      }

      // If there are items needing approval, show the approval modal
      if (itemsNeedingApproval.length > 0) {
        setApprovalItems(itemsNeedingApproval);
        setShowApprovalModal(true);
        toast.dismiss(toastId);
        return;
      }

      // Check approvals for the counter party (offeree)
      for (const nft of offer.requestedNFTs) {
        const approvedAddress = await nftContractWithSigner.getApproved(nft.id);
        if (approvedAddress.toLowerCase() !== contract.target.toLowerCase()) {
          throw new Error(`The counter party hasn't approved NFT ${nft.name} for transfer`);
        }
      }

      if (offer.requestedUSDC > 0n) {
        const allowance = await usdcContractWithSigner.allowance(offer.to, contract.target);
        if (allowance < offer.requestedUSDC) {
          throw new Error(`The counter party hasn't approved enough USDC for transfer`);
        }
      }

      // Proceed with sealing the deal
      await sealDeal(offerId, toastId);

    } catch (error) {
      console.error(`Error sealing deal:`, error);
      toast.update(toastId, { 
        render: `Error sealing deal: ${error.message}`,
        type: "error",
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  const sealDeal = async (offerId, toastId) => {
    try {
      toast.update(toastId, { 
        render: 'Sealing the deal...', 
        type: "info", 
        isLoading: true 
      });

      const tx = await contract.sealDeal(offerId);
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
            Offer finalized successfully!
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

      fetchOffers(); // Refresh offers after successful sealing
    } catch (error) {
      console.error(`Error sealing deal:`, error);
      toast.update(toastId, { 
        render: `Error sealing deal: ${error.message}`,
        type: "error",
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  const handleApprove = async () => {
    let toastId = toast.loading('Processing approvals...', { autoClose: false });
    try {
      const signer = await provider.getSigner(account);
      const nftContractWithSigner = nftContract.connect(signer);
      const usdcContractWithSigner = usdcContract.connect(signer);

      for (const item of approvalItems) {
        if (item.type === 'NFT') {
          await nftContractWithSigner.approve(contract.target, item.id);
        } else if (item.type === 'USDC') {
          await usdcContractWithSigner.approve(contract.target, item.amount);
        }
      }

      toast.update(toastId, {
        render: 'All items approved successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });

      setShowApprovalModal(false);
      setApprovalItems([]);
    } catch (error) {
      console.error('Error during approval:', error);
      toast.update(toastId, {
        render: `Error during approval: ${error.message}`,
        type: 'error',
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  if (loading) {
    return <div>Loading offers and NFT data...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <h2 className="section-title">Made Offers</h2>
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
                    <i className="bi bi-clipboard"></i>
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
                    <i className="bi bi-clipboard"></i>
                  </Button>
                </div>
                {renderOfferSection("You give:", offer.offeredNFTs, offer.offeredUSDC, true)}
                {renderOfferSection("You get:", offer.requestedNFTs, offer.requestedUSDC, false)}
                <div>
                  <strong>Status:</strong> {renderOfferStatus(offer.status)}
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                {offer.status === OfferStatus.Pending && (
                  <Button variant="danger" onClick={() => handleCancelOffer(offer.id)}>
                    Cancel Offer
                  </Button>
                )}
                {offer.status === OfferStatus.Accepted && (
                  <>
                    <Button 
                      variant="secondary" 
                      onClick={() => checkAndUpdateApprovals(offer)}
                      className="me-2"
                    >
                      Check Approvals
                    </Button>
                    <Button variant="success" onClick={() => handleSealDeal(offer.id)}>
                      Finalize
                    </Button>
                  </>
                )}
              </div>
            </Card.Body>
          </Card>
        ))
      )}
      
      <Modal show={showApprovalModal} onHide={() => setShowApprovalModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Approval Required</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>The following items need approval before sealing the deal:</p>
          <ul>
            {approvalItems.map((item, index) => (
              <li key={index}>
                {item.type === 'NFT' ? `NFT: ${item.name} (ID: ${item.id})` : `USDC: ${ethers.formatUnits(item.amount, 6)} USDC`}
              </li>
            ))}
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApprove}>
            Approve All
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default MadeOffers;
