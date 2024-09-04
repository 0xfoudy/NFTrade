// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTrade is Ownable{
    // The following addresses are on Polygon.
    address constant public NFT_CONTRACT = 0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD;
    address constant public USDC_CONTRACT = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    uint256 private currentID = 0;
    uint8 public fees = 150;
    uint16 public FEES_DENUM = 10000;

    enum Status {
        Pending,
        Accepted,
        Rejected,
        Canceled,
        Completed
    }

    struct Offer {
        uint256 offerID;
        address offerer;
        address offeree;
        uint256[] offeredNFTs;
        uint256 offeredUSDC;
        uint256[] requestedNFTs;
        uint256 requestedUSDC;
        Status status;
    }

    // offeree => offerID[]
    mapping(address => uint256[]) userOffersMapping;
    // offerer => offerID[]
    mapping(address => uint256[]) OfferedMapping;
    // offerID => Offer
    mapping(uint256 => Offer) offersMapping;

    // Add these event declarations at the top of the contract
    event OfferCreated(uint256 indexed offerID, address indexed offerer, address indexed offeree);
    event OfferAccepted(uint256 indexed offerID, address indexed offeree);
    event DealSealed(uint256 indexed offerID, address indexed offerer, address indexed offeree);
    event OfferRejected(uint256 indexed offerID, address indexed offeree);
    event OfferCanceled(uint256 indexed offerID, address indexed offerer);
    event FeesUpdated(uint8 newFees);

    constructor() Ownable(msg.sender) {}

    function makeOffer(uint256[] calldata _offeredNFTs, uint256 _offeredUSDC, uint256[] calldata _requestedNFTs, uint256 _requestedUSDC, address _offeree) public {
        require(isCurrentlyOwner(_offeredNFTs, msg.sender), "You do not own the offered NFTs");
        require(isCurrentlyOwner(_requestedNFTs, _offeree), "Offeree does not own the requested NFTs");
        Offer memory offer = Offer(++currentID, msg.sender, _offeree, _offeredNFTs, _offeredUSDC, _requestedNFTs, _requestedUSDC, Status.Pending);
        userOffersMapping[_offeree].push(currentID);
        OfferedMapping[msg.sender].push(currentID);
        offersMapping[currentID] = offer;
        
        // Add this line at the end of the function
        emit OfferCreated(currentID, msg.sender, _offeree);
    }

    function isCurrentlyOwner(uint256[] calldata _NFTsID, address _owner) internal returns (bool) {
        for(uint256 i = 0; i < _NFTsID.length; ++i) {
            (bool success, bytes memory result) = NFT_CONTRACT.call(abi.encodeWithSignature("ownerOf(uint256)", _NFTsID[i]));
            require(success, "Failed to get owner...");
            address NFTOwner = abi.decode(result, (address));
            if(NFTOwner != _owner) return false;
        }
        return true;
    }

    function acceptOffer(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(msg.sender == offer.offeree, "Caller not offeree");
        offer.status = Status.Accepted;
        
        // Add this line at the end of the function
        emit OfferAccepted(_offerID, msg.sender);
    }

    function sealDeal(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(offer.status == Status.Accepted, "Offer not yet accepted");
        require(offer.status != Status.Completed, "Offer already completed");
        require(msg.sender == offer.offeree || msg.sender == offer.offerer, "Caller unrelated to offer");

        offer.status = Status.Completed;

        uint256 feesFromOfferer = offer.offeredUSDC * fees / FEES_DENUM;
        uint256 USDCForOfferee = offer.offeredUSDC - feesFromOfferer;
        uint256 feesFromOfferee = offer.requestedUSDC * fees / FEES_DENUM;
        uint256 USDCForOfferer = offer.requestedUSDC - feesFromOfferee;


        // transfer NFTs
        require(safeBatchTransferFrom(offer.offerer, offer.offeree, offer.offeredNFTs), "Offerer's NFT transfer failed");
        require(safeBatchTransferFrom(offer.offeree, offer.offerer, offer.requestedNFTs), "Offeree's NFT transfer failed");


        // transfer USDC
        require(transferUSDC(offer.offerer, owner(), feesFromOfferer), "Offerer's fee USDC transfer failed");
        require(transferUSDC(offer.offerer, offer.offeree, USDCForOfferee), "Offerer's USDC transfer failed");
        require(transferUSDC(offer.offeree, owner(), feesFromOfferee), "Offeree's fee USDC transfer failed");
        require(transferUSDC(offer.offeree, offer.offerer, USDCForOfferer), "Offeree's USDC transfer failed");

        // Emit the DealSealed event
        emit DealSealed(_offerID, offer.offerer, offer.offeree);
    }

    function transferUSDC(address from, address to, uint256 amount) internal returns (bool) {
        (bool success, ) = USDC_CONTRACT.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        return success;
    }
    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _NFTsID) internal returns (bool success){
        for (uint256 i = 0; i < _NFTsID.length; ++i) {
            (success, ) = NFT_CONTRACT.call(abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", _from, _to, _NFTsID[i]));
            require(success, "Failed to transfer NFT");
        }
        return true;
    }

    function viewReceivedOffers(address _offeree) public view returns (uint256[] memory) {
        return userOffersMapping[_offeree];
    }

    function viewOfferedOffers(address _offerer) public view returns (uint256[] memory) {
        return OfferedMapping[_offerer];
    }

    function viewOffer(uint256 _offerID) public view returns (Offer memory) {
        return offersMapping[_offerID];
    }

    function cancelOfferedOffer(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(msg.sender == offer.offerer, "Caller not offerer");
        require(offer.status != Status.Accepted, "Offer already accepted");

        offer.status = Status.Canceled;
        emit OfferCanceled(_offerID, msg.sender);
    }
    

    function rejectOffer(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(msg.sender == offer.offeree, "Caller not offeree");
        require(offer.status != Status.Accepted, "Offer already accepted");

        offer.status = Status.Rejected;
        emit OfferRejected(_offerID, msg.sender);
    }


    function updateFees(uint8 _newFees) public onlyOwner {
        require(_newFees <= 300, "Fees cannot exceed 6%");
        fees = _newFees;
        emit FeesUpdated(_newFees);
    }
}
