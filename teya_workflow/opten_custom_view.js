// ==UserScript==
// @name         Opten – Teya Onboarding menüpont (Riport fölé, no default redirect)
// @namespace    https://teya.local/
// @version      1.2.6
// @description  "Teya Onboarding" menüpont beszúrása a bal oldali menübe a Riport fölé, default navigáció nélkül. Oldalsó drawer + mezőnkénti copy, onboardinghoz szükséges adatokkal.
// @author       You
// @match        https://www.opten.hu/*
// @match        https://opten.hu/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      iban.hu
// @connect      www.iban.hu
// ==/UserScript==

(() => {
  "use strict";

  // -------------------------
  // CONFIG (opcionális)
  // -------------------------
  const TEYA_ONBOARDING_BASE_URL = "";

  const INSERTED_LI_ID = "teya-onboarding-li";
  const INSERTED_A_ID  = "teya-onboarding-link";
  const DEFAULT_IBAN_COUNTRY = "HU";

  const MCC_AVG_BASKET_VALUE_HUF = new Map([
    // TODO: töltsd fel kézzel megbízható, 2025-ös források alapján (MCC -> átlagos kosárérték, HUF).
  ]);

  const SELECTORS = {
    companyName: "#parsedNameTitle",
    taxId: "#asz_l_txt_1",
    registryNumber: "#cjsz_txt_2",
    address: "#asz_txt_0"
  };

  const DRAWER_IDS = {
    backdrop: "teya-onb-backdrop",
    drawer: "teya-onb-drawer",
    body: "teya-onb-body",
    title: "teya-onb-title",
    sub: "teya-onb-sub",
    toast: "teya-onb-toast"
  };

  let cachedDataKey = "";
  let cachedDataPromise = null;
  let cachedData = null;
  let currentData = null;

  const MCC_DB_SOURCE_EN = `
Category\tBusiness Activity\tMCC Code\tMCC Description
Health, Beauty & Wellness\tVeterinary\t742\tVeterinary Services
Services\tOther Services\t763\tAgricultural Cooperatives
Services\tCraftsman/Contractor\t780\tHorticultural and Landscaping
Services\tCraftsman/Contractor\t1520\tGeneral Contractors-Residential and Commercial
Services\tCraftsman/Contractor\t1711\tAir Conditioning, Heating, and Plumbing Contractors
Services\tCraftsman/Contractor\t1731\tElectrical Contractors
Services\tCraftsman/Contractor\t1740\tInsulation, Masonry, Plastering, Stonework, and Tile Setting Contractors
Services\tCraftsman/Contractor\t1750\tCarpentry Contractors
Services\tCraftsman/Contractor\t1761\tRoofing and Siding, Sheet Metal Work Contractors
Services\tCraftsman/Contractor\t1771\tConcrete Work Contractors
Services\tCraftsman/Contractor\t1799\tContractors, Special Trade-not elsewhere classified
Services\tOther Services\t2741\tMiscellaneous Publishing and Printing
Services\tOther Services\t2791\tTypesetting, Plate Making, and Related Services
Services\tOther Services\t2842\tSanitation, Polishing, and Specialty Cleaning Preparations
Services\tTaxi/Limo/Ride-Hailing Drivers\t4111\tTransportation - Suburban and Local Commuter Passenger, including Ferries
Health, Beauty & Wellness\tMedical Services\t4119\tAmbulance Services
Retail\tAutomotive Parts\t5013\tMotor Vehicle Supplies and New Parts
Services\tTaxi/Limo/Ride-Hailing Drivers\t4121\tLimousines and Taxicabs
Services\tBus/Shuttle/Coach Services\t4131\tBus Lines
Services\tMotor Servicing, Freight Carriers, and Trucking\t4214\tMotor Freight Carriers, Trucking‚ Local/Long Distance, Moving and Storage Companies, Local Delivery
Services\tMotor Servicing, Freight Carriers, and Trucking\t4215\tCourier Services-Air and Ground, Freight Forwarders
Services\tOther Services\t4225\tPublic Warehousing-Farm Products, Refrigerated Goods, Household Goods Storage
Leisure & Entertainment\tHospitality & Experiences\t4411\tCruise Lines
Services\tMotor Servicing, Freight Carriers, and Trucking\t4457\tBoat Leases and Boat Rentals
Services\tOther Services\t4468\tMarinas, Marine Service/Supplies
Services\tOther Services\t4511\tAir Carriers, Airlines‚ not elsewhere classified
Leisure & Entertainment\tTravel Agencies\t4582\tAirports, Airport Terminals, Flying Fields
Retail\tHardware/Computer/Electronics Shops\t4812\tTelecommunication Equipment Including Telephone Sales
Leisure & Entertainment\tTravel Agencies\t4722\tTravel Agencies and Tour Operators
Retail\tAuthorised Reseller of Hardware/Computer/Electronics\t5200\tHome Supply Warehouse Stores
Services\tOther Services\t4784\tBridge and Road Fees, Tolls
Retail\tStationary/Office Supplies\t5111\tStationery, Office Supplies, Printing and Writing Paper
Services\tOther Services\t4789\tTransportation Services-not elsewhere classifed
Services\tMiscellaneous Repair Shops and Related Services\t4814\tTelecommunication Services including but not limited to prepaid phone services and recurring phone services
Services\tMiscellaneous Repair Shops and Related Services\t4816\tComputer Network/Information Services
BLOCK\tBLOCK\t4829\tMoney Transfer
Services\tOther Services\t4899\tCable, Satellite, and Other Pay Television and Radio Services
Services\tOther Services\t4900\tUtilities-Electric, Gas, Heating Oil, Sanitary, Water
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5021\tOffice and Commercial Furniture
Retail\tHardware/Computer/Electronics Shops\t5039\tConstruction Materials-not elsewhere classifed
Retail\tHardware/Computer/Electronics Shops\t5044\tOffice, Photographic, Photocopy, and Microfilm Equipment
Retail\tHardware/Computer/Electronics Shops\t5045\tComputers, Computer Peripheral Equipment, Software
Retail\tOther Retail\t5046\tCommercial Equipment‚ not elsewhere classified
Health, Beauty & Wellness\tMedical Services\t5047\tDental/Laboratory/Medical/Ophtthalmic Hospital Equipment and Supplies
Services\tOther Services\t5051\tMetal Service Centers and Offices
Retail\tHardware/Computer/Electronics Shops\t5065\tElectrical Parts and Equipment
Retail\tHardware/Computer/Electronics Shops\t5072\tHardware Equipment and Supplies
Retail\tHardware/Computer/Electronics Shops\t5074\tPlumbing and Heating Equipment
Retail\tOther Retail\t5085\tIndustrial Supplies-not elsewhere classified
Retail\tClock, Jeweller, Watch, and Silverware Stores\t5094\tPrecious Stones and Metals, Watches and Jewelry
Retail\tOther Retail\t5099\tDurable Goods‚ not elsewhere classified
Health, Beauty & Wellness\tDrugstores, Chemists, Pharmacies\t5122\tDrugs, Drug Proprietors, and Druggists Sundries
Retail\tClothing/Footwear/Accessories/Apparel\t5131\tPiece Goods, Notions, and Other Dry Goods
Retail\tClothing/Footwear/Accessories/Apparel\t5137\tMen's, Women's, and Children's Uniforms and Commercial Clothing
Retail\tClothing/Footwear/Accessories/Apparel\t5139\tCommercial Footwear
Retail\tOther Retail\t5169\tChemicals and Allied Products‚ not elsewhere classified
Retail\tOther Retail\t5172\tPetroleum and Petroleum Products
Retail\tBook Stores\t5192\tBooks, Periodicals, and Newspapers
Retail\tFlorists\t5193\tFlorists Supplies, Nursery Stock, and Flowers
Retail\tHardware/Computer/Electronics Shops\t5198\tPaints, Varnishes, and Supplies
Retail\tOther Retail\t5199\tNondurable Goods‚ not elsewhere classified
Retail\tHardware/Computer/Electronics Shops\t5211\tBuilding Materials, Lumber Stores
Retail\tHardware/Computer/Electronics Shops\t5231\tGlass, Paint, Wallpaper Stores
Retail\tHardware/Computer/Electronics Shops\t5251\tHardware Stores
Retail\tHardware/Computer/Electronics Shops\t5261\tLawn and Garden Supply Stores
Retail\tMotor Vehicles (new vehicles only)\t5271\tMobile Home Dealers
Retail\tOther Retail\t5300\tWholesale Clubs
Retail\tOther Retail\t5309\tDuty Free Stores
Retail\tOther Retail\t5310\tDiscount Stores
Retail\tOther Retail\t5311\tDepartment Stores
Retail\tOther Retail\t5331\tVariety Stores
Retail\tOutdoor Market\t5399\tMiscellaneous General Merchandise Stores
Retail\tOther Retail\t5399\tMiscellaneous General Merchandise Stores
Retail\tFood/Grocery/Convenience/Corner Shops\t5411\tGrocery Stores, Supermarkets
Retail\tFood/Grocery/Convenience/Corner Shops\t5422\tFreezer, Locker Meat Provisioners
Retail\tFood/Grocery/Convenience/Corner Shops\t5441\tCandy, Nut, Confectionery Stores
Retail\tFood/Grocery/Convenience/Corner Shops\t5451\tDairy Products Stores
Food and Beverage\tBakery\t5462\tBakeries
Retail\tFood/Grocery/Convenience/Corner Shops\t5499\tMiscellaneous Food Stores‚ Convenience Stores, Markets, Specialty Stores
Retail\tMotor Vehicles (new vehicles only)\t5511\tAutomobile and Truck Dealers‚ Sales, Service, Repairs, Parts, and Leasing
BLOCK\tBLOCK\t5521\t(Used Only) Automobile and Truck Dealers‚ Sales, and Parts
Retail\tHardware/Computer/Electronics Shops\t5531\tAuto Store, Home Supply Stores
Retail\tAutomotive Parts\t5532\tAutomotive Tire Stores
Retail\tAutomotive Parts\t5533\tAutomotive Parts, Accessories Stores
Services\tMotor Servicing, Freight Carriers, and Trucking\t5541\tService Stations (with or without Ancillary Services)
Services\tMotor Servicing, Freight Carriers, and Trucking\t5542\tFuel Dispenser, Automated
Retail\tMotor Vehicles (new vehicles only)\t5551\tBoat Dealers
Retail\tMotor Vehicles (new vehicles only)\t5561\tCamper Dealers, Recreational and Utility Trailers
Retail\tMotor Vehicles (new vehicles only)\t5571\tMotorcycle Shops and Dealers
Retail\tMotor Vehicles (new vehicles only)\t5592\tMotor Home Dealers
Retail\tMotor Vehicles (new vehicles only)\t5598\tSnowmobile Dealers
Retail\tMotor Vehicles (new vehicles only)\t5599\tMiscellaneous Automotive, Aircraft, and Farm Equipment Dealers‚ not elsewhere classified
Retail\tClothing/Footwear/Accessories/Apparel\t5611\tMen's and Boys' Clothing and Accessories Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5621\tWomen's Ready to Wear Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5631\tWomen's Accessory and Specialty Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5641\tChildren's and Infants' Wear Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5651\tFamily Clothing Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5655\tSports Apparel, Riding Apparel Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5661\tShoe Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5681\tFurriers and Fur Shops
Retail\tClothing/Footwear/Accessories/Apparel\t5691\tMen's and Women's Clothing Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5697\tAlterations, Mending, Seamstresses, Tailors
Retail\tClothing/Footwear/Accessories/Apparel\t5698\tWig and Toupee Shops
Retail\tClothing/Footwear/Accessories/Apparel\t5699\tAccessory and Apparel Stores, Miscellaneous
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5712\tEquipment, Furniture, and Home Furnishings Stores (except Appliances)
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5713\tFloor Covering Stores
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5714\tDrapery, Upholstery, and Window Coverings Stores
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5718\tFireplace, Fireplace Screens and Accessories Stores
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5719\tMiscellaneous House Furnishing Specialty Shops
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5722\tHousehold Appliance Stores
Retail\tHardware/Computer/Electronics Shops\t5732\tElectronic Sales
Retail\tArt, Music, Photo, and Film Shop\t5733\tMusic Stores‚ Musical Instruments, Pianos, Sheet Music
Retail\tHardware/Computer/Electronics Shops\t5734\tComputer Software Stores
Retail\tArt, Music, Photo, and Film Shop\t5735\tRecord Shops
Food and Beverage\tCatering/Delivery\t5811\tCaterers
Food and Beverage\tCafé/Restaurant\t5812\tEating Places, Restaurants
Food and Beverage\tFine Dining\t5812\tEating Places, Restaurants
Food and Beverage\tBar/Pub/Club\t5813\tBars, Cocktail Lounges, Discotheques, Nightclubs, and Taverns‚ Drinking Places (Alcoholic Beverages)
Food and Beverage\tFood Truck/Cart\t5814\tFast Food Restaurants
Food and Beverage\tFast Food Restaurant\t5814\tFast Food Restaurants
Retail\tOther Retail\t5815\tDigital Goods‚ Audiovisual Media Including Books, Movies, and Music
BLOCK\tBLOCK\t5816\tDigital Goods - Games
BLOCK\tBLOCK\t5817\tDigital Goods‚ Software Applications (Excluding Games)
BLOCK\tBLOCK\t5818\tDigital Goods‚ Multi-Category
Health, Beauty & Wellness\tDrugstores, Chemists, Pharmacies\t5912\tDrug Stores, Pharmacies
Retail\tBeer, Wine, and Spirits\t5921\tPackage Stores, Beer, Wine, and Liquor
Retail\tAntique Shops - Sales, Repairs, and Restoration Services\t5931\tAntique Shops - Second Hand Stores, Used Merchandise Stores
Services\tMiscellaneous Repair Shops and Related Services\t5932\tSales, Repairs, and Restoration Services
BLOCK\tBLOCK\t5933\tPawn Shops and Salvage Yards
Services\tMiscellaneous Repair Shops and Related Services\t5935\tSalvage and Wrecking Yards
Leisure & Entertainment\tSports/Recreation\t5940\tBicycle Shops‚ Sales and Service
Leisure & Entertainment\tSports/Recreation\t5941\tSporting Goods Stores
Retail\tBook Stores\t5942\tBook Stores
Retail\tStationary/Office Supplies\t5943\tOffice, School Supply, and Stationery Stores
Retail\tClock, Jeweller, Watch, and Silverware Stores\t5944\tClock, Jewelry, Watch, and Silverware Store
Retail\tHobby, Toy, and Game Shops\t5945\tGame, Toy, and Hobby Shops
Retail\tArt, Music, Photo, and Film Shop\t5946\tCamera and Photographic Supply Stores
Retail\tCard Shops, Gift, Novelty, and Souvenir Shops\t5947\tCard, Gift, Novelty, and Souvenir Shops
Retail\tClothing/Footwear/Accessories/Apparel\t5948\tLeather Goods and Luggage Stores
Retail\tClothing/Footwear/Accessories/Apparel\t5949\tFabric, Needlework, Piece Goods, and Sewing Stores
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5950\tCrystal and Glassware Stores
BLOCK\tBLOCK\t5960\tDirect Marketing‚ Insurance Services
BLOCK\tBLOCK\t5962\tDirect Marketing‚ Travel-Related Arrangement Services
Retail\tOther Retail\t5963\tDoor-to-Door Sales
BLOCK\tBLOCK\t5964\tDirect Marketing‚ Catalog Merchants
Retail\tOther Retail\t5965\tDirect Marketing‚ Combination Catalog and Retail Merchants
BLOCK\tBLOCK\t5967\tDirect Marketing‚ Inbound Telemarketing Merchants including Adult services
BLOCK\tBLOCK\t5968\tDirect Marketing‚ Continuity/Subscription Merchants
Retail\tOther Retail\t5969\tDirect Marketing‚ Other Direct Marketers‚ not elsewhere classified
Retail\tArt, Music, Photo, and Film Shop\t5970\tArtist Supply Stores, Craft Shops
Retail\tArt Dealers and Galleries\t5971\tArt Dealers and Galleries
Retail\tMuseum/Gallery/Cultural\t5971\tArt Dealers and Galleries
Retail\tCard Shops, Gift, Novelty, and Souvenir Shops\t5972\tStamp and Coin Stores‚ Philatelic and Numismatic Supplies
Retail\tOther Retail\t5973\tReligious Goods Stores
Health, Beauty & Wellness\tMedical Services\t5975\tHearing Aids‚ Sales, Service, Supply Stores
Health, Beauty & Wellness\tMedical Services\t5976\tOrthopedic Goods‚ Artificial Limb Stores
Health, Beauty & Wellness\tCosmetic Stores\t5977\tCosmetic Stores
Retail\tOther Retail\t5983\tFuel Dealers‚ Coal, Fuel Oil, Liquefied Petroleum, Wood
Retail\tFlorists\t5992\tFlorists
Retail\tTobacco/Cigar/Vape/E-Cigarette Shop\t5993\tCigar Stores and Stands
Retail\tNewstand/Magazines\t5994\tNews Dealers and Newsstands
Retail\tPet Shops\t5995\tPet Shops-Pet Food and Supplies
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5996\tSwimming Pools‚ Sales and Supplies
Retail\tHardware/Computer/Electronics Shops\t5997\tElectric Razor Stores‚ Sales and Service
Retail\tFurniture, Home Furnishings, and Equipment Stores\t5998\tTent and Awning Shops
Retail\tOther Retail\t5999\tMiscellaneous and Specialty Retail Stores
BLOCK\tBLOCK\t6010\tManual Cash Disbursements‚ Customer Financial Institution
BLOCK\tBLOCK\t6011\tAutomated Cash Disbursements‚ Customer Financial Institution
BLOCK\tBLOCK\t6050\tQuasi Cash‚ Customer Financial Institution
BLOCK\tBLOCK\t6051\tQuasi Cash-Merchant
BLOCK\tBLOCK\t6211\tSecurities‚ Brokers/Dealers
BLOCK\tBLOCK\t6300\tInsurance Sales, Underwriting
Services\tLetting Agents\t6513\tReal Estate Agents and Managers‚ Rentals
Services\tReal Estate, Propery Rentals\t6513\tReal Estate Agents and Managers‚ Rentals
BLOCK\tBLOCK\t6540\tPOI Funding Transactions (Exluding MoneySend)
Leisure & Entertainment\tHospitality & Experiences\t7011\tLodging‚ Hotels, Motels, Resorts‚ not elsewhere classified
Leisure & Entertainment\tSports/Recreation\t7032\tRecreational and Sporting Camps
Leisure & Entertainment\tSports/Recreation\t7033\tCampgrounds and Trailer Parks
Services\tOther Services\t7210\tCleaning, Garment, and Laundry Services
Services\tOther Services\t7211\tBusiness & Miscellaneous Services
Services\tOther Services\t7216\tDry Cleaners
Services\tOther Services\t7217\tCarpet and Upholstery Cleaning
Services\tPhotography Studios\t7221\tPhotographic Studios
Health, Beauty & Wellness\tBeauty / Barber\t7230\tBarber and Beauty Shops
Services\tMiscellaneous Repair Shops and Related Services\t7251\tHat Cleaning Shops, Shoe Repair Shops, Shoe Shine Parlors
Services\tOther Services\t7261\tFuneral Service and Crematories
BLOCK\tBLOCK\t7273\tDating Services
Services\tOther Services\t7277\tDebt, Marriage, Personal‚Äö Counseling Service
Services\tOther Services\t7278\tBuying/Shopping Clubs, Services
Services\tShort-Term Rental Services\t7296\tClothing Rental‚ Costumes, Uniforms, and Formal Wear
Health, Beauty & Wellness\tMassage Parlours\t7297\tMassage Parlors
Health, Beauty & Wellness\tFitness / Wellness / Spa\t7298\tHealth and Beauty Spas
Services\tOther Services\t7299\tOther Services‚ not elsewhere classified
Services\tOther Services\t7311\tAdvertising Services
Services\tOther Services\t7321\tConsumer Credit Reporting Agencies
Retail\tArt, Music, Photo, and Film Shop\t7333\tCommercial Art, Graphics, Photography
Services\tOther Services\t7338\tQuick Copy, Reproduction, and Blueprinting Services
Services\tOther Services\t7342\tExterminating and Disinfecting Services
Services\tOther Services\t7349\tCleaning and Maintenance, Janitorial Services
Services\tOther Services\t7361\tEmployment Agencies, Temporary Help Services
Services\tOther Services\t7372\tComputer Programming, Data Processing, and Integrated Systems Design Services
Services\tOther Services\t7375\tInformation Retrieval Services
Retail\tHardware/Computer/Electronics Shops\t7379\tComputer Maintenance, Repair, and Services‚ not elsewhere classified
Services\tConsulting\t7392\tConsulting, Management, and Public Relations Services
Services\tOther Services\t7393\tDetective Agencies, Protective Agencies, Security Services including Armored Cars, Guard Dogs
Services\tShort-Term Rental Services\t7394\tEquipment Rental and Leasing Services, Furniture Rental, Tool Rental
Services\tPhotography Studios\t7395\tPhoto Developing, Photofinishing Laboratories
Services\tOther Services\t7399\tBusiness Services‚ not elsewhere classified
Services\tMotor Vehicle Rentals\t7512\tAutomobile Rental Agency‚ not elsewhere classified
Services\tMotor Vehicle Rentals\t7513\tTruck Rental
Services\tMotor Vehicle Rentals\t7519\tMotor Home and Recreational Vehicle Rental
Services\tAuto Shops/Garages/Parking Lots\t7523\tAutomobile Parking Lots and Garages
Services\tAuto Shops/Garages/Parking Lots\t7531\tAutomotive Body Repair Shops
Services\tAuto Shops/Garages/Parking Lots\t7534\tTire Retreading and Repair Shops
Services\tAuto Shops/Garages/Parking Lots\t7535\tAutomotive Paint Shops
Services\tAuto Shops/Garages/Parking Lots\t7538\tAutomotive Service Shops
Services\tAuto Shops/Garages/Parking Lots\t7542\tCar Washes
Services\tOther Services\t7549\tTowing Services
Services\tMiscellaneous Repair Shops and Related Services\t7622\tElectronic Repair Shops
Services\tMiscellaneous Repair Shops and Related Services\t7623\tAir Conditioning and Refrigeration Repair Shops
Services\tMiscellaneous Repair Shops and Related Services\t7629\tAppliance Repair Shops, Electrical and Small
Services\tMiscellaneous Repair Shops and Related Services\t7631\tClock, Jewelry, and Watch Repair Shops
Services\tMiscellaneous Repair Shops and Related Services\t7641\tFurniture‚ Reupholstery and Repair, Refinishing
Services\tMiscellaneous Repair Shops and Related Services\t7692\tWelding Repair
Services\tMiscellaneous Repair Shops and Related Services\t7699\tMiscellaneous Repair Shops and Related Services
Leisure & Entertainment\tMovies/Film/Video Entertainment\t7829\tMotion Picture and Video Tape Production and Distribution
Leisure & Entertainment\tMovies/Film/Video Entertainment\t7832\tMotion Picture Theaters
Services\tShort-Term Rental Services\t7841\tVideo Entertainment Rental Stores
Leisure & Entertainment\tPerforming Arts\t7911\tDance Halls, Schools, and Studios
Leisure & Entertainment\tPerforming Arts\t7922\tTheatrical Producers (except Motion Pictures), Ticket Agencies
Leisure & Entertainment\tPerforming Arts\t7929\tBands, Orchestras, and Miscellaneous Entertainers‚ not elsewhere classified
Leisure & Entertainment\tSports/Recreation\t7932\tPool and Billiard Establishments
Leisure & Entertainment\tSports/Recreation\t7933\tBowling Alleys
Leisure & Entertainment\tSports/Recreation\t7941\tAthletic Fields, Commercial Sports, Professional Sports Clubs, Sports Promoters
Leisure & Entertainment\tHospitality & Experiences\t7991\tTourist Attractions and Exhibits
Leisure & Entertainment\tSports/Recreation\t7992\tGolf Courses, Public
Leisure & Entertainment\tMovies/Film/Video Entertainment\t7993\tVideo Amusement Game Supplies
Leisure & Entertainment\tMovies/Film/Video Entertainment\t7994\tVideo Game Arcades/Establishments
BLOCK\tBLOCK\t7995\tGambling Transactions
Leisure & Entertainment\tEvents/Festivals\t7996\tAmusement Parks, Carnivals, Circuses, Fortune Tellers
Leisure & Entertainment\tSports/Recreation\t7997\tClubs‚ Country Clubs, Membership (Athletic, Recreation, Sports), Private Golf Courses
Leisure & Entertainment\tMuseum/Gallery/Cultural\t7998\tAquariums, Dolphinariums, Zoos, and Seaquariums
Leisure & Entertainment\tEvents/Festivals\t7999\tRecreation Services‚ not elsewhere classified
Health, Beauty & Wellness\tMedical Services\t8011\tDoctors‚ not elsewhere classified
Health, Beauty & Wellness\tDentistry\t8021\tDentists, Orthodontists
Health, Beauty & Wellness\tMedical Services\t8031\tOsteopathic Physicians
Health, Beauty & Wellness\tMedical Services\t8041\tChiropractors
Health, Beauty & Wellness\tMedical Services\t8042\tOptometrists, Ophthalmologists
Health, Beauty & Wellness\tMedical Services\t8043\tOpticians, Optical Goods, and Eyeglasses
Health, Beauty & Wellness\tMedical Services\t8049\tChiropodists, Podiatrists
Health, Beauty & Wellness\tMedical Services\t8050\tNursing and Personal Care Facilities
Health, Beauty & Wellness\tMedical Services\t8062\tHospitals
Health, Beauty & Wellness\tDentistry\t8071\tDental and Medical Laboratories
Health, Beauty & Wellness\tMedical Services\t8099\tHealth Practitioners, Medical Services‚Äö not elsewhere classified
Services\tAttorney/Lawyer/Solicitor\t8111\tAttorneys, Legal Services
Services\tEducation\t8211\tSchools, Elementary and Secondary
Services\tEducation\t8220\tColleges, Universities, Professional Schools, and Junior Colleges
Services\tEducation\t8244\tSchools, Business and Secretarial
Services\tEducation\t8249\tSchools, Trade and Vocational
Services\tEducation\t8299\tSchools and Educational Services‚Äö not elsewhere classified
Services\tOther Services\t8351\tChild Care Services
Charities, Organisations, Government\tCharity\t8398\tOrganizations, Charitable and Social Service
Charities, Organisations, Government\tFor-Profit Membership Organisation\t8641\tAssociations‚ Civic, Social, and Fraternal
BLOCK\tBLOCK\t8651\tOrganizations, Political
BLOCK\tBLOCK\t8661\tOrganizations, Religious
Charities, Organisations, Government\tFor-Profit Membership Organisation\t8675\tAutomobile Associations
Charities, Organisations, Government\tNon-Profit Membership Organisation\t8699\tOrganizations, Membership‚Äö not elsewhere classified
Charities, Organisations, Government\tFor-Profit Membership Organisation\t8699\tOrganizations, Membership‚Äö not elsewhere classified
Services\tArchitecural, Engineering and Surveying Services\t8911\tArchitectural, Engineering, and Surveying Services
Services\tAccounting\t8931\tAccounting, Auditing, and Bookkeeping Services
BLOCK\tBLOCK\t8999\tProfessional Services‚ not elsewhere classified
Services\tOther Services\t9222\tFines
Services\tOther Services\t9311\tTax Payments
Charities, Organisations, Government\tGovernment Related\t9399\tGovernment Services‚ not elsewhere classified
Charities, Organisations, Government\tGovernment Related\t9402\tPostal Services‚ Government Only
`.trim();

  const MCC_TRANSLATION_MAP = [
    ["Health, Beauty & Wellness", "Egészség, szépség és wellness"],
    ["Leisure & Entertainment", "Szabadidő és szórakozás"],
    ["Food and Beverage", "Étel és ital"],
    ["Charities, Organisations, Government", "Jótékonyság, szervezetek, kormányzat"],
    ["Services", "Szolgáltatások"],
    ["Retail", "Kiskereskedelem"],
    ["Other Services", "Egyéb szolgáltatások"],
    ["Miscellaneous", "Egyéb"],
    ["Services", "Szolgáltatások"],
    ["Service", "Szolgáltatás"],
    ["Stores", "üzletek"],
    ["Store", "üzlet"],
    ["Shops", "boltok"],
    ["Shop", "bolt"],
    ["Repair", "javítás"],
    ["Contractor", "kivitelező"],
    ["Contractors", "kivitelezők"],
    ["Medical", "orvosi"],
    ["Hospital", "kórház"],
    ["Pharmacy", "gyógyszertár"],
    ["Pharmacies", "gyógyszertárak"],
    ["Dental", "fogászati"],
    ["Laboratory", "laboratóriumi"],
    ["Beauty", "szépség"],
    ["Barber", "fodrász"],
    ["Massage", "masszázs"],
    ["Fitness", "fitnesz"],
    ["Spa", "spa"],
    ["Taxi", "taxi"],
    ["Limousines", "limuzinok"],
    ["Bus", "busz"],
    ["Courier", "futár"],
    ["Trucking", "fuvarozás"],
    ["Transportation", "szállítás"],
    ["Travel Agencies", "utazási irodák"],
    ["Travel Agency", "utazási iroda"],
    ["Airports", "repülőterek"],
    ["Air Carriers", "légifuvarozók"],
    ["Cruise Lines", "hajóutak"],
    ["Grocery", "élelmiszer"],
    ["Supermarkets", "szupermarketek"],
    ["Bakeries", "pékségek"],
    ["Restaurants", "éttermek"],
    ["Bars", "bárok"],
    ["Nightclubs", "éjszakai klubok"],
    ["Liquor", "szeszes italok"],
    ["Jewelry", "ékszer"],
    ["Books", "könyvek"],
    ["Florists", "virágboltok"],
    ["Hardware", "vasáru"],
    ["Electronics", "elektronika"],
    ["Computers", "számítógépek"],
    ["Software", "szoftver"],
    ["Automobile", "autó"],
    ["Motorcycle", "motorkerékpár"],
    ["Boat", "hajó"],
    ["Camper", "lakókocsi"],
    ["Clothing", "ruházat"],
    ["Footwear", "lábbeli"],
    ["Accessory", "kiegészítő"],
    ["Furniture", "bútor"],
    ["Home Furnishings", "lakberendezés"],
    ["Office", "iroda"],
    ["Catering", "catering"],
    ["Fast Food", "gyorsétterem"],
    ["Digital Goods", "digitális termékek"],
    ["Insurance", "biztosítás"],
    ["Marketing", "marketing"],
    ["Telemarketing", "telemarketing"],
    ["Gambling", "szerencsejáték"],
    ["Religious", "vallási"],
    ["Political", "politikai"]
  ];

  function translateMccText(value) {
    if (!value) return "";
    let text = value;
    MCC_TRANSLATION_MAP.forEach(([from, to]) => {
      text = text.replaceAll(from, to);
    });
    if (text !== value) {
      return `${text} (${value})`;
    }
    return text;
  }

  function translateMccSource(source) {
    const lines = source.split("\n");
    const [header, ...rest] = lines;
    const translatedHeader = "Kategória\tTevékenység\tMCC kód\tMCC leírás";
    const translatedLines = rest.map((line) => {
      const [category, activity, mcc, description] = line.split("\t");
      return [
        translateMccText(category),
        translateMccText(activity),
        mcc,
        translateMccText(description)
      ].join("\t");
    });
    return [translatedHeader, ...translatedLines].join("\n").trim();
  }

  const MCC_DB_SOURCE = translateMccSource(MCC_DB_SOURCE_EN);

  const RESTRICTED_KEYWORDS = [
    "klub",
    "club",
    "masszázs",
    "massage",
    "ékszer",
    "jewelry",
    "jótékonys",
    "charity",
    "autószerel",
    "vehicle repair",
    "utazási iroda",
    "travel agency",
    "lőtér",
    "shooting range",
    "mesterember",
    "contractor",
    "ingatlan",
    "real estate",
    "galéria",
    "art dealer",
    "autókeresked",
    "car dealer",
    "online oktatás",
    "online education"
  ];

  const BLOCKED_KEYWORDS = [
    "pénzátutal",
    "money transfer",
    "digital goods",
    "gambling",
    "szerencsejáték",
    "pawn",
    "zálog",
    "telemarketing",
    "dating",
    "társkereső",
    "political",
    "religious",
    "kaszinó",
    "casino"
  ];

  const MCC_DB = MCC_DB_SOURCE.split("\n").slice(1).map((line) => {
    const [category, activity, mcc, description] = line.split("\t");
    return {
      category: (category || "").trim(),
      activity: (activity || "").trim(),
      mcc: (mcc || "").trim(),
      description: (description || "").trim()
    };
  });

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function normalizeSpace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeForMatch(value) {
    return normalizeSpace(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeNumberField(value) {
    return (value || "").replace(/[\s-]+/g, "");
  }

  function parseHungarianAmount(value) {
    if (!value) return null;
    const normalized = normalizeSpace(value);
    const unitMatch = normalized.match(/\b(eFt|mFt)\b/i);
    const unit = unitMatch ? unitMatch[1].toLowerCase() : "";
    let numberText = normalized.replace(/[^\d.,-]/g, "");
    if (!numberText) return null;
    if (numberText.includes(",") && numberText.includes(".")) {
      numberText = numberText.replace(/\./g, "").replace(",", ".");
    } else {
      numberText = numberText.replace(",", ".");
    }
    const numeric = Number.parseFloat(numberText);
    if (!Number.isFinite(numeric)) return null;
    const multiplier = unit === "eft" ? 1000 : unit === "mft" ? 1000000 : 1;
    return Math.round(numeric * multiplier);
  }

  function formatRevenueValue(value) {
    if (!value) return "";
    const normalized = normalizeSpace(value);
    const parsed = parseHungarianAmount(normalized);
    if (Number.isFinite(parsed)) return String(parsed);
    const withYear = normalized.match(/\b\d{4}\s*:\s*([0-9\s.-]+)/);
    if (withYear) return extractDigits(withYear[1]);
    const firstNumber = normalized.match(/([0-9][0-9\s.-]*)/);
    return firstNumber ? extractDigits(firstNumber[1]) : normalized;
  }

  function extractDigits(value) {
    return (value || "").replace(/[^\d]/g, "");
  }

  function textFrom(root, selector) {
    const el = root.querySelector(selector);
    if (!el) return "";
    return (el.textContent || "").trim();
  }

  function textFromLabel(root, labelText) {
    const labels = Array.from(root.querySelectorAll(".data-line--label"));
    const match = labels.find((label) =>
      normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
    );
    const value = match?.parentElement?.querySelector(".data-line--content");
    return normalizeSpace(value?.textContent || "");
  }

  function textFromTitle(root, titleText) {
    const titles = Array.from(root.querySelectorAll(".data-title"));
    const match = titles.find((title) =>
      normalizeSpace(title.textContent || "").toLowerCase().includes(titleText.toLowerCase())
    );
    if (!match) return "";
    const row = match.closest(".row") || match.parentElement;
    const value = row?.querySelector(".data-value");
    return normalizeSpace(value?.textContent || "");
  }

  function getEidFromUrl() {
    const m = window.location.pathname.match(/eid(\d+)/i);
    return m ? `eid${m[1]}` : "";
  }

  function normalizeRegistryNumber(value) {
    return (value || "").replace(/\D/g, "");
  }

  function readRegistryNumberFromDoc(root) {
    const fromLabel = textFromLabel(root, "Cégjegyzékszám");
    if (fromLabel) return normalizeSpace(fromLabel.split("(")[0]);

    const head = normalizeSpace(root.querySelector("#subhead-1 .data-line--content")?.textContent || "");
    if (head) return normalizeSpace(head.split("(")[0]);

    const title = normalizeSpace(root.querySelector(".kh-heading .fs-medium")?.textContent || "");
    const match = title.match(/Cégjegyzékszám:\s*([0-9 ]+)/i);
    return match ? normalizeSpace(match[1]) : "";
  }

  function buildPayload(root = document) {
    const name =
      textFrom(root, SELECTORS.companyName) ||
      normalizeSpace(root.querySelector("#subhead-2 .head-title h3")?.textContent) ||
      normalizeSpace(root.querySelector("h1")?.textContent) ||
      normalizeSpace(root.title || document.title);

    const taxId =
      textFrom(root, SELECTORS.taxId) ||
      normalizeSpace(root.querySelector("#subhead-21 h3")?.textContent) ||
      textFromLabel(root, "Adószám");

    return {
      companyName: name || "",
      taxId,
      registryNumber: textFrom(root, SELECTORS.registryNumber) || textFromLabel(root, "Cégjegyzékszám"),
      address: textFrom(root, SELECTORS.address) || normalizeSpace(root.querySelector("#subhead-5 .head-title a")?.textContent),
      eid: getEidFromUrl(),
      sourceUrl: window.location.href
    };
  }

  function safeCopy(text) {
    try {
      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(text, "text");
        return true;
      }
    } catch (_) {}
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
    return false;
  }

  function htmlToDocument(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function requestHtml(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest not available"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (response) => resolve(response.responseText || ""),
        onerror: () => reject(new Error("Request failed"))
      });
    });
  }

  function requestJson(url, body) {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          data: JSON.stringify(body || {}),
          onload: (response) => {
            try {
              resolve(JSON.parse(response.responseText || "{}"));
            } catch (error) {
              reject(error);
            }
          },
          onerror: () => reject(new Error("Request failed"))
        });
      });
    }

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(body || {})
    }).then((response) => response.json());
  }

  // -------------------------
  // Read blocks (Opten DOM)
  // -------------------------
  function readTelephelyek(root) {
    const nodes = Array.from(root.querySelectorAll("#subhead-7 .head-title a, #subhead-6 .head-title a"));
    return nodes.map((node) => normalizeSpace(node.textContent)).filter(Boolean);
  }

  function readTevekenysegek(root) {
    const list = Array.from(root.querySelectorAll("#subhead-9 .title-text"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (list.length) return list;
    const fallback = textFromTitle(root, "Főtevékenysége");
    return fallback ? [fallback] : [];
  }

  function groupActivities(activities, mccMatches) {
    const groups = new Map();
    activities.forEach((activity) => {
      const matches = mccMatches.filter((match) => match.activity === activity);
      const category = matches[0]?.entry?.category || "Egyéb";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(activity);
    });
    return groups;
  }

  function matchActivitiesToMcc(activities) {
    const results = [];
    activities.forEach((activity) => {
      const normalizedActivity = normalizeForMatch(activity);
      if (!normalizedActivity) return;
      const activityTokens = new Set(normalizedActivity.split(" ").filter((token) => token.length > 2));

      let bestMatch = null;
      let bestScore = 0;

      MCC_DB.forEach((entry) => {
        const entryText = normalizeForMatch(`${entry.activity} ${entry.description}`);
        if (!entryText) return;
        let score = 0;
        activityTokens.forEach((token) => {
          if (entryText.includes(token)) score += 1;
        });
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      });

      if (bestMatch && bestScore >= 2) {
        results.push({ activity, entry: bestMatch, score: bestScore });
      }
    });
    return results;
  }

  function evaluateKycStatus(activities) {
    if (!activities.length) {
      return {
        status: "ISMERETLEN",
        note: "Nincs tevékenységi kör adat.",
        matches: []
      };
    }

    const matches = matchActivitiesToMcc(activities);
    const normalizedActivities = normalizeForMatch(activities.join(" "));

    const blockedByKeyword = BLOCKED_KEYWORDS.find((keyword) => normalizedActivities.includes(normalizeForMatch(keyword)));
    const restrictedByKeyword = RESTRICTED_KEYWORDS.find((keyword) => normalizedActivities.includes(normalizeForMatch(keyword)));
    const blockedByMcc = matches.find((match) => match.entry.category === "BLOCK");

    if (blockedByKeyword || blockedByMcc) {
      return {
        status: "BLOCKED",
        note: blockedByKeyword
          ? `Tiltott kulcsszó: ${blockedByKeyword}`
          : `Tiltott MCC: ${blockedByMcc?.entry?.mcc || ""} ${blockedByMcc?.entry?.description || ""}`.trim(),
        matches
      };
    }

    if (restrictedByKeyword) {
      return {
        status: "KORLÁTOZOTT",
        note: `Korlátozott tevékenység kulcsszó: ${restrictedByKeyword}`,
        matches
      };
    }

    return {
      status: "OK",
      note: matches.length ? "Talált MCC egyezések alapján KYC szempontból rendben." : "Nincs egyértelmű MCC egyezés.",
      matches
    };
  }

  function readEmails(root) {
    const emails = Array.from(root.querySelectorAll("#subhead-90 a[href^='mailto:']"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (emails.length) return Array.from(new Set(emails)).join("; ");
    return "";
  }

  function readQuickReport(root) {
    const quickReport = root.querySelector("#quickReport");
    if (quickReport) {
      return normalizeSpace(
        quickReport.querySelector(".fw-bold.fs-15, .text-center.fw-bold.fs-15, .card-body .fw-bold")?.textContent || ""
      );
    }

    const quickReportButton = Array.from(root.querySelectorAll("button, h2"))
      .find((node) => normalizeSpace(node.textContent || "").toLowerCase().includes("gyorsjelentés"));
    const collapseId = quickReportButton?.getAttribute("data-bs-target")
      || quickReportButton?.getAttribute("aria-controls");
    const collapse = collapseId
      ? root.querySelector(collapseId.startsWith("#") ? collapseId : `#${collapseId}`)
      : null;
    const scope = collapse || quickReportButton?.closest(".accordion-item") || root;
    const summary = scope.querySelector(".text-center.text-opten-blue.fw-bold")
      || scope.querySelector(".text-opten-blue.fw-bold")
      || scope.querySelector(".text-center.fw-bold");
    return normalizeSpace(summary?.textContent || "");
  }

  function readKapcsoltVallalkozasok(root) {
    const value = root.querySelector("#contactnetworkinfo .inner-contact-text");
    if (value) return normalizeSpace(value.textContent || "");
    const fallback = root.querySelector("[data-contact-count], .contact-count, .kh-stat, .kh-summary");
    return normalizeSpace(fallback?.textContent || "");
  }

  function readValueByDataTitle(root, titleText, scopeSelector = "") {
    const scope = scopeSelector ? root.querySelector(scopeSelector) || root : root;
    const titleNodes = Array.from(scope.querySelectorAll(".data-title"));
    const match = titleNodes.find((node) =>
      normalizeSpace(node.textContent).toLowerCase().includes(titleText.toLowerCase())
    );
    if (!match) return "";
    const row = match.closest(".row") || match.parentElement;
    const value = row?.querySelector(".data-value");
    if (value) return normalizeSpace(value.textContent || "");
    const sibling = match.nextElementSibling;
    return normalizeSpace(sibling?.textContent || "");
  }

  function readFinancialRevenue(root) {
    const map = new Map();
    const titleEls = Array.from(root.querySelectorAll(".data-title"));
    titleEls.forEach((el) => {
      const text = normalizeSpace(el.textContent);
      const match = text.match(/Nettó árbevétel\s*\((\d{4})\)/i);
      if (!match) return;
      const year = parseInt(match[1], 10);
      const row = el.closest(".row") || el.parentElement;
      const value = normalizeSpace(row?.querySelector(".data-value")?.textContent || "");
      if (value) map.set(year, value);
    });

    const years = Array.from(map.keys()).sort((a, b) => b - a);
    if (years.length) {
      const latest = years[0];
      return formatRevenueValue(map.get(latest));
    }

    const tableRow = Array.from(root.querySelectorAll("tr"))
      .find((row) => normalizeSpace(row.querySelector(".row-title")?.textContent || "").toLowerCase()
        .includes("értékesítés nettó árbevétele"));
    if (tableRow) {
      const table = tableRow.closest("table");
      const isThousandHuf = normalizeSpace(table?.textContent || "").toLowerCase().includes("ezer huf");
      const cells = Array.from(tableRow.querySelectorAll("td"));
      const valueCell = cells.slice(1).find((cell) => {
        const value = normalizeSpace(cell.textContent || "");
        return value && value !== "-";
      });
      const value = normalizeSpace(valueCell?.textContent || "");
      if (value) {
        const withUnit = isThousandHuf ? `${value} eFt` : value;
        return formatRevenueValue(withUnit);
      }
    }

    const fallback = readValueByDataTitle(root, "Nettó árbevétel", "#shortfinancialdata") || "";
    return formatRevenueValue(fallback);
  }

  function extractRevenueValue(revenueText) {
    return formatRevenueValue(revenueText);
  }

  function calculateEstimatedCardMonthlyRevenue(revenueText) {
    const digits = extractRevenueValue(revenueText);
    if (!digits) return "";
    const revenue = Number.parseFloat(digits);
    if (!Number.isFinite(revenue)) return "";
    return String(Math.round((revenue * 0.7) / 12));
  }

  function readAuthorizedSignatories(root) {
    const items = Array.from(root.querySelectorAll("#subhead-13 .oi-list-item"));
    if (!items.length) return [];

    const findLabelValue = (itemRoot, labelText) => {
      const labels = Array.from(itemRoot.querySelectorAll(".data-line--label"));
      const match = labels.find((label) =>
        normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
      );
      return normalizeSpace(match?.parentElement?.querySelector(".data-line--content")?.textContent || "");
    };

    return items.map((item) => {
      const head = item.querySelector(".head-title");
      const anchors = head ? Array.from(head.querySelectorAll("a")) : [];
      const name = normalizeSpace(anchors[0]?.textContent || "");
      const role = normalizeSpace(head?.querySelector("span.text-opten-blue")?.textContent || "");
      const address = normalizeSpace(anchors[1]?.textContent || "");
      const birth = findLabelValue(item, "Születés ideje");
      const taxId = findLabelValue(item, "Adóazonosító");

      const hatalyos = findLabelValue(item, "Hatályos");

      return {
        name: name || "ISMERETLEN",
        role: role || "ISMERETLEN",
        address: address || "ISMERETLEN",
        birth: birth || "ISMERETLEN",
        taxId: taxId || "ISMERETLEN",
        hatalyos: hatalyos || "ISMERETLEN"
      };
    });
  }

  function readBankAccounts(root) {
    const items = Array.from(root.querySelectorAll("#subhead-32 .oi-list-item"));
    const accounts = items.map((item) => {
      const account = normalizeSpace(item.querySelector(".head-title h3")?.textContent || "");
      if (!account) return null;
      const dataLines = Array.from(item.querySelectorAll(".text-content .data-line"));
      const bankLine = dataLines.find((line) => {
        const label = normalizeSpace(line.querySelector(".data-line--label")?.textContent || "");
        return !label;
      });
      const bankName = normalizeSpace(bankLine?.querySelector(".data-line--content")?.textContent || "");
      return {
        account,
        bankName
      };
    }).filter(Boolean);

    const unique = new Map();
    accounts.forEach((entry) => {
      if (!unique.has(entry.account)) {
        unique.set(entry.account, entry);
      }
    });
    return Array.from(unique.values());
  }

  function parseCegadatlap(root) {
    const base = buildPayload(root);
    const registryNumber = base.registryNumber || readRegistryNumberFromDoc(root);

    return {
      companyName: base.companyName,
      taxId: base.taxId,
      registryNumber,
      address: base.address,
      companyForm: textFromLabel(root, "Cégforma") || textFromTitle(root, "Cégforma"),
      establishmentDate: textFromLabel(root, "Alakulás dátuma"),
      registrationDate: textFromLabel(root, "Bejegyzés dátuma"),
      activities: readTevekenysegek(root),
      headquarters: normalizeSpace(root.querySelector("#subhead-5 .head-title a")?.textContent || ""),
      telephelyek: readTelephelyek(root),
      statisticalNumber: normalizeSpace(root.querySelector("#subhead-20 h3")?.textContent || ""),
      emails: readEmails(root),
      signatories: readAuthorizedSignatories(root),
      bankAccounts: readBankAccounts(root)
    };
  }

  function hasCegadatlapData(data) {
    if (!data) return false;
    const keys = [
      "companyName",
      "taxId",
      "registryNumber",
      "address",
      "companyForm",
      "headquarters"
    ];
    return keys.some((key) => normalizeSpace(data[key] || "") !== "");
  }

  function parseCegriport(root) {
    return {
      revenue: readFinancialRevenue(root),
      quickReport: readQuickReport(root),
      kapcsolatok: readKapcsoltVallalkozasok(root)
    };
  }

  function hasReportData(report) {
    if (!report) return false;
    return Object.values(report).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim() !== "";
      return Boolean(value);
    });
  }

  function hasHaloData(data) {
    if (!data) return false;
    const keys = ["corporateOwnersCount", "kapcsolatok"];
    return keys.some((key) => normalizeSpace(data[key] || "") !== "");
  }

  function parseKapcsolatiHalo(root) {
    const hoverNodes = Array.from(root.querySelectorAll("#khra .kh-item-hover"));
    const companyNames = new Set();
    let fallbackCount = 0;
    const addName = (name) => {
      const clean = normalizeSpace(name);
      if (clean) companyNames.add(clean);
    };

    hoverNodes.forEach((node) => {
      const label = normalizeSpace(node.textContent);
      if (label.includes("A cég neve") || label.includes("A magánszemély neve")) {
        const strong = node.querySelector("b");
        addName(strong?.textContent || "");
      }
    });

    if (!companyNames.size) {
      const items = Array.from(root.querySelectorAll("#khra-listing .kh-item-wrapper, #khra .kh-item-wrapper, #khra .kh-item"));
      items.forEach((item) => {
        if ((item.id || "").includes("InspectedCompany")) return;
        fallbackCount += 1;
        const name = item.querySelector(".kh-item-center .textTruncate, .kh-item-title, .kh-item-name");
        addName(name?.textContent || item.textContent || "");
      });
    }

    const count = companyNames.size || fallbackCount;
    return {
      corporateOwnersCount: count ? String(count) : "",
      kapcsolatok: count ? String(count) : "",
      haloMetrics: null
    };
  }

  function getEidNumber(value) {
    const digits = extractDigits(value || "");
    return digits || "";
  }

  function buildKapcsolatiHaloPayload(eidNumber) {
    if (!eidNumber) return null;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const selectedDate = `${now.getFullYear()}-${month}-${day}`;
    const timestamp = document.querySelector("#khra")?.dataset?.timestamp || null;
    const lang = document.documentElement.lang || "hu";

    return {
      ID: Number(eidNumber),
      lang,
      Owners: 1,
      Managers: 1,
      SelectedDate: selectedDate,
      YearsBack: 2,
      vt: 1,
      PredecessorSuccessor: 1,
      HideDefunct: 0,
      IneffectiveRelations: 1,
      DisusedRelations: 1,
      AddressConnections: 1,
      PartialAddresses: 0,
      HighlightLines: 1,
      SupplementaryInfo: 1,
      ClientInfo: 1,
      ClientInfoName: 1,
      TimeStamp: timestamp
    };
  }

  function parseKapcsolatiHaloResponse(payload) {
    const boxes = Array.isArray(payload?.ContactNetwork?.Boxes) ? payload.ContactNetwork.Boxes : [];
    const lines = payload?.ContactNetwork?.ConnectionLines;
    const lineCount = Array.isArray(lines)
      ? lines.length
      : lines && typeof lines === "object"
        ? Object.keys(lines).length
        : 0;

    const getBoxId = (box) => String(box?.ID ?? box?.Id ?? box?.EID ?? box?.eid ?? "");
    const getLineIds = (line) => {
      if (!line || typeof line !== "object") return [];
      const pairs = [
        [line.FromID, line.ToID],
        [line.FromId, line.ToId],
        [line.fromId, line.toId],
        [line.from, line.to],
        [line.SourceID, line.TargetID],
        [line.SourceId, line.TargetId],
        [line.sourceId, line.targetId],
        [line.Source, line.Target]
      ];
      for (const [first, second] of pairs) {
        if (first != null || second != null) {
          return [String(first ?? ""), String(second ?? "")].filter(Boolean);
        }
      }
      return [];
    };

    const companyBoxes = boxes.filter((box) => String(box?.Type || "").toLowerCase() === "company");
    const inspectedBox = boxes.find((box) => String(box?.BoxColumn || "").toLowerCase() === "inspectedcompany");
    const companyIds = new Set(
      companyBoxes.map((box) => getBoxId(box)).filter(Boolean)
    );
    const inspectedId = inspectedBox ? getBoxId(inspectedBox) : "";
    if (inspectedId) companyIds.delete(inspectedId);

    const connectedCompanyIds = new Set();
    const connectionLines = Array.isArray(lines) ? lines : lines && typeof lines === "object" ? Object.values(lines) : [];
    connectionLines.forEach((line) => {
      const ids = getLineIds(line);
      if (ids.length < 2) return;
      const [first, second] = ids;
      if (inspectedId) {
        if (first === inspectedId && companyIds.has(second)) connectedCompanyIds.add(second);
        if (second === inspectedId && companyIds.has(first)) connectedCompanyIds.add(first);
      } else if (companyIds.has(first) && companyIds.has(second)) {
        connectedCompanyIds.add(first);
        connectedCompanyIds.add(second);
      }
    });

    const companyCount = companyIds.size;
    const connectionCount = connectedCompanyIds.size || lineCount;
    return {
      corporateOwnersCount: companyCount ? String(companyCount) : "",
      kapcsolatok: connectionCount ? String(connectionCount) : (companyCount ? String(companyCount) : ""),
      haloMetrics: buildKapcsolatiHaloMetrics(boxes, connectionLines)
    };
  }

  function getHaloBoxLabel(box) {
    const candidates = [
      box?.Title,
      box?.Name,
      box?.CompanyName,
      box?.PersonName,
      box?.DisplayName,
      box?.Label
    ];
    return normalizeSpace(candidates.find((value) => normalizeSpace(value)) || "");
  }

  function buildKapcsolatiHaloMetrics(boxes, connectionLines) {
    if (!Array.isArray(boxes) || !boxes.length) return null;
    const normalizedLines = Array.isArray(connectionLines)
      ? connectionLines
      : connectionLines && typeof connectionLines === "object"
        ? Object.values(connectionLines)
        : [];
    const getBoxId = (box) => String(box?.ID ?? box?.Id ?? box?.EID ?? box?.eid ?? "");
    const getLineIds = (line) => {
      if (!line || typeof line !== "object") return [];
      const pairs = [
        [line.FromID, line.ToID],
        [line.FromId, line.ToId],
        [line.fromId, line.toId],
        [line.from, line.to],
        [line.SourceID, line.TargetID],
        [line.SourceId, line.TargetId],
        [line.sourceId, line.targetId],
        [line.Source, line.Target]
      ];
      for (const [first, second] of pairs) {
        if (first != null || second != null) {
          return [String(first ?? ""), String(second ?? "")].filter(Boolean);
        }
      }
      return [];
    };

    const degrees = new Map();
    const ids = [];
    boxes.forEach((box) => {
      const id = getBoxId(box);
      if (!id) return;
      ids.push(id);
      degrees.set(id, 0);
    });

    normalizedLines.forEach((line) => {
      const idsInLine = getLineIds(line);
      if (idsInLine.length < 2) return;
      const [first, second] = idsInLine;
      if (first && degrees.has(first)) degrees.set(first, (degrees.get(first) || 0) + 1);
      if (second && degrees.has(second)) degrees.set(second, (degrees.get(second) || 0) + 1);
    });

    const inspectedBox = boxes.find((box) => String(box?.BoxColumn || "").toLowerCase() === "inspectedcompany");
    const inspectedId = inspectedBox ? getBoxId(inspectedBox) : "";
    const inspectedDegree = inspectedId ? (degrees.get(inspectedId) || 0) : 0;

    const typeCounts = boxes.reduce((acc, box) => {
      const type = String(box?.Type || "other").toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const totalNodes = ids.length;
    const totalConnections = normalizedLines.length;
    const averageDegree = totalNodes ? (2 * totalConnections) / totalNodes : 0;
    let maxDegree = 0;
    let maxDegreeLabel = "";
    degrees.forEach((value, id) => {
      if (value > maxDegree) {
        maxDegree = value;
        const box = boxes.find((entry) => getBoxId(entry) === id);
        maxDegreeLabel = getHaloBoxLabel(box);
      }
    });

    const isolatedNodes = Array.from(degrees.values()).filter((value) => value === 0).length;
    const companyCount = typeCounts.company || 0;
    const personCount = typeCounts.person || 0;
    const addressCount = typeCounts.address || 0;
    const otherCount = totalNodes - companyCount - personCount - addressCount;
    const riskFlags = [];

    if (totalNodes >= 20) riskFlags.push("Nagyméretű háló");
    if (inspectedDegree >= 8) riskFlags.push("Sok közvetlen kapcsolat a vizsgált cégnél");
    if (companyCount >= 10) riskFlags.push("Sok kapcsolódó cég");
    if (personCount >= 10) riskFlags.push("Sok kapcsolódó magánszemély");
    if (averageDegree >= 3) riskFlags.push("Sűrű kapcsolati háló");

    return {
      totalNodes,
      totalConnections,
      averageDegree,
      maxDegree,
      maxDegreeLabel,
      inspectedDegree,
      companyCount,
      personCount,
      addressCount,
      otherCount,
      isolatedNodes,
      riskFlags
    };
  }

  // -------------------------
  // IBAN helpers (local validation, based on jschaedl/iban-validation registry)
  // -------------------------
  const IBAN_REGISTRY = {
    "AD": {
      "country_name": "Andorra",
      "iban_structure": "AD2!n4!n4!n12!c",
      "bban_structure": "4!n4!n12!c",
      "iban_regex": "/^AD\\\\d{2}\\\\d{4}\\\\d{4}[A-Z0-9]{12}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{4}[A-Z0-9]{12}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "AD1200012030200359100100",
      "iban_print_format_example": "AD12 0001 2030 2003 5910 0100",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "AE": {
      "country_name": "United Arab Emirates (The)",
      "iban_structure": "AE2!n3!n16!n",
      "bban_structure": "3!n16!n",
      "iban_regex": "/^AE\\\\d{2}\\\\d{3}\\\\d{16}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{16}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "AE070331234567890123456",
      "iban_print_format_example": "AE07 0331 2345 6789 0123 456",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "AL": {
      "country_name": "Albania",
      "iban_structure": "AL2!n8!n16!c",
      "bban_structure": "8!n16!c",
      "iban_regex": "/^AL\\\\d{2}\\\\d{8}[A-Z0-9]{16}$/",
      "bban_regex": "/^\\\\d{8}[A-Z0-9]{16}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "AL47212110090000000235698741",
      "iban_print_format_example": "AL47 2121 1009 0000 0002 3569 8741",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "8!n",
      "bank_identifier_regex": "/^\\\\d{8}$/",
      "branch_identifier_position": "4-8",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "AT": {
      "country_name": "Austria",
      "iban_structure": "AT2!n5!n11!n",
      "bban_structure": "5!n11!n",
      "iban_regex": "/^AT\\\\d{2}\\\\d{5}\\\\d{11}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{11}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "AT611904300234573201",
      "iban_print_format_example": "AT61 1904 3002 3457 3201",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "AZ": {
      "country_name": "Azerbaijan",
      "iban_structure": "AZ2!n4!a20!c",
      "bban_structure": "4!a20!c",
      "iban_regex": "/^AZ\\\\d{2}[A-Z]{4}[A-Z0-9]{20}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "AZ21NABZ00000000137010001944",
      "iban_print_format_example": "AZ21 NABZ 0000 0000 1370 1000 1944",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "BA": {
      "country_name": "Bosnia and Herzegovina",
      "iban_structure": "BA2!n3!n3!n8!n2!n",
      "bban_structure": "3!n3!n8!n2!n",
      "iban_regex": "/^BA\\\\d{2}\\\\d{3}\\\\d{3}\\\\d{8}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{3}\\\\d{8}\\\\d{2}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "BA391290079401028494",
      "iban_print_format_example": "BA39 1290 0794 0102 8494",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "4-6",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "BE": {
      "country_name": "Belgium",
      "iban_structure": "BE2!n3!n7!n2!n",
      "bban_structure": "3!n7!n2!n",
      "iban_regex": "/^BE\\\\d{2}\\\\d{3}\\\\d{7}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{7}\\\\d{2}$/",
      "iban_length": 16,
      "bban_length": 12,
      "iban_electronic_format_example": "BE68539007547034",
      "iban_print_format_example": "BE68 5390 0754 7034",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "BG": {
      "country_name": "Bulgaria",
      "iban_structure": "BG2!n4!a4!n2!n8!c",
      "bban_structure": "4!a4!n2!n8!c",
      "iban_regex": "/^BG\\\\d{2}[A-Z]{4}\\\\d{4}\\\\d{2}[A-Z0-9]{8}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{4}\\\\d{2}[A-Z0-9]{8}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "BG80BNBG96611020345678",
      "iban_print_format_example": "BG80 BNBG 9661 1020 3456 78",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "BH": {
      "country_name": "Bahrain",
      "iban_structure": "BH2!n4!a14!c",
      "bban_structure": "4!a14!c",
      "iban_regex": "/^BH\\\\d{2}[A-Z]{4}[A-Z0-9]{14}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{14}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "BH67BMAG00001299123456",
      "iban_print_format_example": "BH67 BMAG 0000 1299 1234 56",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "BI": {
      "country_name": "Burundi",
      "iban_structure": "BI2!n5!n5!n11!n2!n",
      "bban_structure": "5!n5!n11!n2!n",
      "iban_regex": "/^BI\\\\d{2}\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "BI4210000100010000332045181",
      "iban_print_format_example": "BI42 10000 10001 00003320451 81",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "6-10",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "BR": {
      "country_name": "Brazil",
      "iban_structure": "BR2!n8!n5!n10!n1!a1!c",
      "bban_structure": "8!n5!n10!n1!a1!c",
      "iban_regex": "/^BR\\\\d{2}\\\\d{8}\\\\d{5}\\\\d{10}[A-Z]{1}[A-Z0-9]{1}$/",
      "bban_regex": "/^\\\\d{8}\\\\d{5}\\\\d{10}[A-Z]{1}[A-Z0-9]{1}$/",
      "iban_length": 29,
      "bban_length": 25,
      "iban_electronic_format_example": "BR1800360305000010009795493C1",
      "iban_print_format_example": "BR18 0036 0305 0000 1000 9795 493C 1",
      "bank_identifier_position": "1-8",
      "bank_identifier_structure": "8!n",
      "bank_identifier_regex": "/^\\\\d{8}$/",
      "branch_identifier_position": "9-13",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "BY": {
      "country_name": "Republic of Belarus",
      "iban_structure": "BY2!n4!c4!n16!c",
      "bban_structure": "4!c4!n16!c",
      "iban_regex": "/^BY\\\\d{2}[A-Z0-9]{4}\\\\d{4}[A-Z0-9]{16}$/",
      "bban_regex": "/^[A-Z0-9]{4}\\\\d{4}[A-Z0-9]{16}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "BY13NBRB3600900000002Z00AB00",
      "iban_print_format_example": "BY13 NBRB 3600 9000 0000 2Z00 AB00",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!c",
      "bank_identifier_regex": "/^[A-Z0-9]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "CH": {
      "country_name": "Switzerland",
      "iban_structure": "CH2!n5!n12!c",
      "bban_structure": "5!n12!c",
      "iban_regex": "/^CH\\\\d{2}\\\\d{5}[A-Z0-9]{12}$/",
      "bban_regex": "/^\\\\d{5}[A-Z0-9]{12}$/",
      "iban_length": 21,
      "bban_length": 17,
      "iban_electronic_format_example": "CH9300762011623852957",
      "iban_print_format_example": "CH93 0076 2011 6238 5295 7",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "CR": {
      "country_name": "Costa Rica",
      "iban_structure": "CR2!n4!n14!n",
      "bban_structure": "4!n14!n",
      "iban_regex": "/^CR\\\\d{2}\\\\d{4}\\\\d{14}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{14}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "CR05015202001026284066",
      "iban_print_format_example": "CR05 0152 0200 1026 2840 66",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "CY": {
      "country_name": "Cyprus",
      "iban_structure": "CY2!n3!n5!n16!c",
      "bban_structure": "3!n5!n16!c",
      "iban_regex": "/^CY\\\\d{2}\\\\d{3}\\\\d{5}[A-Z0-9]{16}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{5}[A-Z0-9]{16}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "CY17002001280000001200527600",
      "iban_print_format_example": "CY17 0020 0128 0000 0012 0052 7600",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "CZ": {
      "country_name": "Czechia",
      "iban_structure": "CZ2!n4!n6!n10!n",
      "bban_structure": "4!n6!n10!n",
      "iban_regex": "/^CZ\\\\d{2}\\\\d{4}\\\\d{6}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{6}\\\\d{10}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "CZ6508000000192000145399",
      "iban_print_format_example": "CZ65 0800 0000 1920 0014 5399",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "DE": {
      "country_name": "Germany",
      "iban_structure": "DE2!n8!n10!n",
      "bban_structure": "8!n10!n",
      "iban_regex": "/^DE\\\\d{2}\\\\d{8}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{8}\\\\d{10}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "DE89370400440532013000",
      "iban_print_format_example": "DE89 3704 0044 0532 0130 00",
      "bank_identifier_position": "1-8",
      "bank_identifier_structure": "8!n",
      "bank_identifier_regex": "/^\\\\d{8}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "DJ": {
      "country_name": "Djibouti",
      "iban_structure": "DJ2!n5!n5!n11!n2!n",
      "bban_structure": "5!n5!n11!n2!n",
      "iban_regex": "/^DJ\\\\d{2}\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "DJ2100010000000154000100186",
      "iban_print_format_example": "DJ21 0001 0000 0001 5400 0100 186",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "6-10",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "DK": {
      "country_name": "Denmark",
      "iban_structure": "DK2!n4!n9!n1!n",
      "bban_structure": "4!n9!n1!n",
      "iban_regex": "/^DK\\\\d{2}\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "DK5000400440116243",
      "iban_print_format_example": "DK50 0040 0440 1162 43",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "DO": {
      "country_name": "Dominican Republic",
      "iban_structure": "DO2!n4!c20!n",
      "bban_structure": "4!c20!n",
      "iban_regex": "/^DO\\\\d{2}[A-Z0-9]{4}\\\\d{20}$/",
      "bban_regex": "/^[A-Z0-9]{4}\\\\d{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "DO28BAGR00000001212453611324",
      "iban_print_format_example": "DO28 BAGR 0000 0001 2124 5361 1324",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!c",
      "bank_identifier_regex": "/^[A-Z0-9]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "EE": {
      "country_name": "Estonia",
      "iban_structure": "EE2!n2!n2!n11!n1!n",
      "bban_structure": "2!n2!n11!n1!n",
      "iban_regex": "/^EE\\\\d{2}\\\\d{2}\\\\d{2}\\\\d{11}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{2}\\\\d{2}\\\\d{11}\\\\d{1}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "EE382200221020145685",
      "iban_print_format_example": "EE38 2200 2210 2014 5685",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "EG": {
      "country_name": "Egypt",
      "iban_structure": "EG2!n4!n4!n17!n",
      "bban_structure": "4!n4!n17!n",
      "iban_regex": "/^EG\\\\d{2}\\\\d{4}\\\\d{4}\\\\d{17}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{4}\\\\d{17}$/",
      "iban_length": 29,
      "bban_length": 25,
      "iban_electronic_format_example": "EG800002000156789012345180002",
      "iban_print_format_example": "EG80 0002 0001 5678 9012 3451 8000 2",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "ES": {
      "country_name": "Spain",
      "iban_structure": "ES2!n4!n4!n1!n1!n10!n",
      "bban_structure": "4!n4!n1!n1!n10!n",
      "iban_regex": "/^ES\\\\d{2}\\\\d{4}\\\\d{4}\\\\d{1}\\\\d{1}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{4}\\\\d{1}\\\\d{1}\\\\d{10}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "ES9121000418450200051332",
      "iban_print_format_example": "ES91 2100 0418 4502 0005 1332",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "FI": {
      "country_name": "Finland",
      "iban_structure": "FI2!n3!n11!n",
      "bban_structure": "3!n11!n",
      "iban_regex": "/^FI\\\\d{2}\\\\d{3}\\\\d{11}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{11}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "FI2112345600000785",
      "iban_print_format_example": "FI21 1234 5600 0007 85",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "FK": {
      "country_name": "Falkland Islands",
      "iban_structure": "FK2!n2!a12!n",
      "bban_structure": "2!a12!n",
      "iban_regex": "/^FK\\\\d{2}[A-Z]{2}\\\\d{12}$/",
      "bban_regex": "/^[A-Z]{2}\\\\d{12}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "FK88SC123456789012",
      "iban_print_format_example": "FK88 SC12 3456 7890 12",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!a",
      "bank_identifier_regex": "/^[A-Z]{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "FO": {
      "country_name": "Faroe Islands",
      "iban_structure": "FO2!n4!n9!n1!n",
      "bban_structure": "4!n9!n1!n",
      "iban_regex": "/^FO\\\\d{2}\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "FO6264600001631634",
      "iban_print_format_example": "FO62 6460 0001 6316 34",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "FR": {
      "country_name": "France",
      "iban_structure": "FR2!n5!n5!n11!c2!n",
      "bban_structure": "5!n5!n11!c2!n",
      "iban_regex": "/^FR\\\\d{2}\\\\d{5}\\\\d{5}[A-Z0-9]{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{5}[A-Z0-9]{11}\\\\d{2}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "FR1420041010050500013M02606",
      "iban_print_format_example": "FR14 2004 1010 0505 0001 3M02 606",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "6-10",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "GB": {
      "country_name": "United Kingdom",
      "iban_structure": "GB2!n4!a6!n8!n",
      "bban_structure": "4!a6!n8!n",
      "iban_regex": "/^GB\\\\d{2}[A-Z]{4}\\\\d{6}\\\\d{8}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{6}\\\\d{8}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "GB29NWBK60161331926819",
      "iban_print_format_example": "GB29 NWBK 6016 1331 9268 19",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-10",
      "branch_identifier_structure": "6!n",
      "branch_identifier_regex": "/^\\\\d{6}$/"
    },
    "GE": {
      "country_name": "Georgia",
      "iban_structure": "GE2!n2!a16!n",
      "bban_structure": "2!a16!n",
      "iban_regex": "/^GE\\\\d{2}[A-Z]{2}\\\\d{16}$/",
      "bban_regex": "/^[A-Z]{2}\\\\d{16}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "GE29NB0000000101904917",
      "iban_print_format_example": "GE29 NB00 0000 0101 9049 17",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!a",
      "bank_identifier_regex": "/^[A-Z]{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "GI": {
      "country_name": "Gibraltar",
      "iban_structure": "GI2!n4!a15!c",
      "bban_structure": "4!a15!c",
      "iban_regex": "/^GI\\\\d{2}[A-Z]{4}[A-Z0-9]{15}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{15}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "GI75NWBK000000007099453",
      "iban_print_format_example": "GI75 NWBK 0000 0000 7099 453",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "GL": {
      "country_name": "Greenland",
      "iban_structure": "GL2!n4!n9!n1!n",
      "bban_structure": "4!n9!n1!n",
      "iban_regex": "/^GL\\\\d{2}\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{9}\\\\d{1}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "GL8964710001000206",
      "iban_print_format_example": "GL89 6471 0001 0002 06",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "GR": {
      "country_name": "Greece",
      "iban_structure": "GR2!n3!n4!n16!c",
      "bban_structure": "3!n4!n16!c",
      "iban_regex": "/^GR\\\\d{2}\\\\d{3}\\\\d{4}[A-Z0-9]{16}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{4}[A-Z0-9]{16}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "GR1601101250000000012300695",
      "iban_print_format_example": "GR16 0110 1250 0000 0001 2300 695",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "4-7",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "GT": {
      "country_name": "Guatemala",
      "iban_structure": "GT2!n4!c20!c",
      "bban_structure": "4!c20!c",
      "iban_regex": "/^GT\\\\d{2}[A-Z0-9]{4}[A-Z0-9]{20}$/",
      "bban_regex": "/^[A-Z0-9]{4}[A-Z0-9]{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "GT82TRAJ01020000001210029690",
      "iban_print_format_example": "GT82 TRAJ 0102 0000 0012 1002 9690",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!c",
      "bank_identifier_regex": "/^[A-Z0-9]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "HR": {
      "country_name": "Croatia",
      "iban_structure": "HR2!n7!n10!n",
      "bban_structure": "7!n10!n",
      "iban_regex": "/^HR\\\\d{2}\\\\d{7}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{7}\\\\d{10}$/",
      "iban_length": 21,
      "bban_length": 17,
      "iban_electronic_format_example": "HR1210010051863000160",
      "iban_print_format_example": "HR12 1001 0051 8630 0016 0",
      "bank_identifier_position": "1-7",
      "bank_identifier_structure": "7!n",
      "bank_identifier_regex": "/^\\\\d{7}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "HU": {
      "country_name": "Hungary",
      "iban_structure": "HU2!n3!n4!n1!n15!n1!n",
      "bban_structure": "3!n4!n1!n15!n1!n",
      "iban_regex": "/^HU\\\\d{2}\\\\d{3}\\\\d{4}\\\\d{1}\\\\d{15}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{4}\\\\d{1}\\\\d{15}\\\\d{1}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "HU42117730161111101800000000",
      "iban_print_format_example": "HU42 1177 3016 1111 1018 0000 0000",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "4-7",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "IE": {
      "country_name": "Ireland",
      "iban_structure": "IE2!n4!a6!n8!n",
      "bban_structure": "4!a6!n8!n",
      "iban_regex": "/^IE\\\\d{2}[A-Z]{4}\\\\d{6}\\\\d{8}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{6}\\\\d{8}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "IE29AIBK93115212345678",
      "iban_print_format_example": "IE29 AIBK 9311 5212 3456 78",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-10",
      "branch_identifier_structure": "6!n",
      "branch_identifier_regex": "/^\\\\d{6}$/"
    },
    "IL": {
      "country_name": "Israel",
      "iban_structure": "IL2!n3!n3!n13!n",
      "bban_structure": "3!n3!n13!n",
      "iban_regex": "/^IL\\\\d{2}\\\\d{3}\\\\d{3}\\\\d{13}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{3}\\\\d{13}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "IL620108000000099999999",
      "iban_print_format_example": "IL62 0108 0000 0009 9999 999",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "4-6",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "IQ": {
      "country_name": "Iraq",
      "iban_structure": "IQ2!n4!a3!n12!n",
      "bban_structure": "4!a3!n12!n",
      "iban_regex": "/^IQ\\\\d{2}[A-Z]{4}\\\\d{3}\\\\d{12}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{3}\\\\d{12}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "IQ98NBIQ850123456789012",
      "iban_print_format_example": "IQ98 NBIQ 8501 2345 6789 012",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-7",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "IS": {
      "country_name": "Iceland",
      "iban_structure": "IS2!n4!n2!n6!n10!n",
      "bban_structure": "4!n2!n6!n10!n",
      "iban_regex": "/^IS\\\\d{2}\\\\d{4}\\\\d{2}\\\\d{6}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{2}\\\\d{6}\\\\d{10}$/",
      "iban_length": 26,
      "bban_length": 22,
      "iban_electronic_format_example": "IS140159260076545510730339",
      "iban_print_format_example": "IS14 0159 2600 7654 5510 7303 39",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "3-4",
      "branch_identifier_structure": "2!n",
      "branch_identifier_regex": "/^\\\\d{2}$/"
    },
    "IT": {
      "country_name": "Italy",
      "iban_structure": "IT2!n1!a5!n5!n12!c",
      "bban_structure": "1!a5!n5!n12!c",
      "iban_regex": "/^IT\\\\d{2}[A-Z]{1}\\\\d{5}\\\\d{5}[A-Z0-9]{12}$/",
      "bban_regex": "/^[A-Z]{1}\\\\d{5}\\\\d{5}[A-Z0-9]{12}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "IT60X0542811101000000123456",
      "iban_print_format_example": "IT60 X054 2811 1010 0000 0123 456",
      "bank_identifier_position": "2-6",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "7-11",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "JO": {
      "country_name": "Jordan",
      "iban_structure": "JO2!n4!a4!n18!c",
      "bban_structure": "4!a4!n18!c",
      "iban_regex": "/^JO\\\\d{2}[A-Z]{4}\\\\d{4}[A-Z0-9]{18}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{4}[A-Z0-9]{18}$/",
      "iban_length": 30,
      "bban_length": 26,
      "iban_electronic_format_example": "JO94CBJO0010000000000131000302",
      "iban_print_format_example": "JO94 CBJO 0010 0000 0000 1310 0030 2",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "KW": {
      "country_name": "Kuwait",
      "iban_structure": "KW2!n4!a22!c",
      "bban_structure": "4!a22!c",
      "iban_regex": "/^KW\\\\d{2}[A-Z]{4}[A-Z0-9]{22}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{22}$/",
      "iban_length": 30,
      "bban_length": 26,
      "iban_electronic_format_example": "KW81CBKU0000000000001234560101",
      "iban_print_format_example": "KW81 CBKU 0000 0000 0000 1234 5601 01",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "KZ": {
      "country_name": "Kazakhstan",
      "iban_structure": "KZ2!n3!n13!c",
      "bban_structure": "3!n13!c",
      "iban_regex": "/^KZ\\\\d{2}\\\\d{3}[A-Z0-9]{13}$/",
      "bban_regex": "/^\\\\d{3}[A-Z0-9]{13}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "KZ86125KZT5004100100",
      "iban_print_format_example": "KZ86 125K ZT50 0410 0100",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LB": {
      "country_name": "Lebanon",
      "iban_structure": "LB2!n4!n20!c",
      "bban_structure": "4!n20!c",
      "iban_regex": "/^LB\\\\d{2}\\\\d{4}[A-Z0-9]{20}$/",
      "bban_regex": "/^\\\\d{4}[A-Z0-9]{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "LB62099900000001001001229114",
      "iban_print_format_example": "LB62 0999 0000 0001 0010 0122 9114",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LC": {
      "country_name": "Saint Lucia",
      "iban_structure": "LC2!n4!a24!c",
      "bban_structure": "4!a24!c",
      "iban_regex": "/^LC\\\\d{2}[A-Z]{4}[A-Z0-9]{24}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{24}$/",
      "iban_length": 32,
      "bban_length": 28,
      "iban_electronic_format_example": "LC55HEMM000100010012001200023015",
      "iban_print_format_example": "LC55 HEMM 0001 0001 0012 0012 0002 3015",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LI": {
      "country_name": "Liechtenstein",
      "iban_structure": "LI2!n5!n12!c",
      "bban_structure": "5!n12!c",
      "iban_regex": "/^LI\\\\d{2}\\\\d{5}[A-Z0-9]{12}$/",
      "bban_regex": "/^\\\\d{5}[A-Z0-9]{12}$/",
      "iban_length": 21,
      "bban_length": 17,
      "iban_electronic_format_example": "LI21088100002324013AA",
      "iban_print_format_example": "LI21 0881 0000 2324 013A A",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LT": {
      "country_name": "Lithuania",
      "iban_structure": "LT2!n5!n11!n",
      "bban_structure": "5!n11!n",
      "iban_regex": "/^LT\\\\d{2}\\\\d{5}\\\\d{11}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{11}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "LT121000011101001000",
      "iban_print_format_example": "LT12 1000 0111 0100 1000",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LU": {
      "country_name": "Luxembourg",
      "iban_structure": "LU2!n3!n13!c",
      "bban_structure": "3!n13!c",
      "iban_regex": "/^LU\\\\d{2}\\\\d{3}[A-Z0-9]{13}$/",
      "bban_regex": "/^\\\\d{3}[A-Z0-9]{13}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "LU280019400644750000",
      "iban_print_format_example": "LU28 0019 4006 4475 0000",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LV": {
      "country_name": "Latvia",
      "iban_structure": "LV2!n4!a13!c",
      "bban_structure": "4!a13!c",
      "iban_regex": "/^LV\\\\d{2}[A-Z]{4}[A-Z0-9]{13}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{13}$/",
      "iban_length": 21,
      "bban_length": 17,
      "iban_electronic_format_example": "LV80BANK0000435195001",
      "iban_print_format_example": "LV80 BANK 0000 4351 9500 1",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "LY": {
      "country_name": "Libya",
      "iban_structure": "LY2!n3!n3!n15!n",
      "bban_structure": "3!n3!n15!n",
      "iban_regex": "/^LY\\\\d{2}\\\\d{3}\\\\d{3}\\\\d{15}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{3}\\\\d{15}$/",
      "iban_length": 25,
      "bban_length": 21,
      "iban_electronic_format_example": "LY380210010000000123456789",
      "iban_print_format_example": "LY38 0210 0100 0000 0123 4567 89",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "4-6",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "MC": {
      "country_name": "Monaco",
      "iban_structure": "MC2!n5!n5!n11!c2!n",
      "bban_structure": "5!n5!n11!c2!n",
      "iban_regex": "/^MC\\\\d{2}\\\\d{5}\\\\d{5}[A-Z0-9]{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{5}[A-Z0-9]{11}\\\\d{2}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "MC5810096180790123456789085",
      "iban_print_format_example": "MC58 1009 6180 7901 2345 6789 085",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "6-10",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "MD": {
      "country_name": "Moldova",
      "iban_structure": "MD2!n2!c18!c",
      "bban_structure": "2!c18!c",
      "iban_regex": "/^MD\\\\d{2}[A-Z0-9]{2}[A-Z0-9]{18}$/",
      "bban_regex": "/^[A-Z0-9]{2}[A-Z0-9]{18}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "MD24AG000225100013104168",
      "iban_print_format_example": "MD24 AG00 0225 1000 1310 4168",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!c",
      "bank_identifier_regex": "/^[A-Z0-9]{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "ME": {
      "country_name": "Montenegro",
      "iban_structure": "ME2!n3!n13!n2!n",
      "bban_structure": "3!n13!n2!n",
      "iban_regex": "/^ME\\\\d{2}\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "ME25505000012345678951",
      "iban_print_format_example": "ME25 5050 0001 2345 6789 51",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "MK": {
      "country_name": "Macedonia",
      "iban_structure": "MK2!n3!n10!c2!n",
      "bban_structure": "3!n10!c2!n",
      "iban_regex": "/^MK\\\\d{2}\\\\d{3}[A-Z0-9]{10}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}[A-Z0-9]{10}\\\\d{2}$/",
      "iban_length": 19,
      "bban_length": 15,
      "iban_electronic_format_example": "MK07250000000042425",
      "iban_print_format_example": "MK07 2500 0000 0042 425",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "MN": {
      "country_name": "Mongolia",
      "iban_structure": "MN2!n4!n12!n",
      "bban_structure": "4!n12!n",
      "iban_regex": "/^MN\\\\d{2}\\\\d{4}\\\\d{12}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{12}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "MN121234567891234567",
      "iban_print_format_example": "MN12 1234 5678 9123 4567",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "MR": {
      "country_name": "Mauritania",
      "iban_structure": "MR2!n5!n5!n11!n2!n",
      "bban_structure": "5!n5!n11!n2!n",
      "iban_regex": "/^MR\\\\d{2}\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{5}\\\\d{11}\\\\d{2}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "MR1300020001010000123456753",
      "iban_print_format_example": "MR13 0002 0001 0100 0012 3456 753",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "6-10",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "MT": {
      "country_name": "Malta",
      "iban_structure": "MT2!n4!a5!n18!c",
      "bban_structure": "4!a5!n18!c",
      "iban_regex": "/^MT\\\\d{2}[A-Z]{4}\\\\d{5}[A-Z0-9]{18}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{5}[A-Z0-9]{18}$/",
      "iban_length": 31,
      "bban_length": 27,
      "iban_electronic_format_example": "MT84MALT011000012345MTLCAST001S",
      "iban_print_format_example": "MT84 MALT 0110 0001 2345 MTLC AST0 01S",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "5-9",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "MU": {
      "country_name": "Mauritius",
      "iban_structure": "MU2!n4!a2!n2!n12!n3!n3!a",
      "bban_structure": "4!a2!n2!n12!n3!n3!a",
      "iban_regex": "/^MU\\\\d{2}[A-Z]{4}\\\\d{2}\\\\d{2}\\\\d{12}\\\\d{3}\\\\d{3}[A-Z]{3}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{2}\\\\d{2}\\\\d{12}\\\\d{3}\\\\d{3}[A-Z]{3}$/",
      "iban_length": 30,
      "bban_length": 26,
      "iban_electronic_format_example": "MU17BOMM0101101030300200000MUR",
      "iban_print_format_example": "MU17 BOMM 0101 1010 3030 0200 000M UR",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "7-8",
      "branch_identifier_structure": "2!n",
      "branch_identifier_regex": "/^\\\\d{2}$/"
    },
    "NI": {
      "country_name": "Nicaragua",
      "iban_structure": "NI2!n4!a20!n",
      "bban_structure": "4!a20!n",
      "iban_regex": "/^NI\\\\d{2}[A-Z]{4}\\\\d{20}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "NI92BAPR00000013000003558124",
      "iban_print_format_example": "NI92 BAPR 0000 0013 0000 0355 8124",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "NL": {
      "country_name": "Netherlands (The)",
      "iban_structure": "NL2!n4!a10!n",
      "bban_structure": "4!a10!n",
      "iban_regex": "/^NL\\\\d{2}[A-Z]{4}\\\\d{10}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{10}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "NL91ABNA0417164300",
      "iban_print_format_example": "NL91 ABNA 0417 1643 00",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "NO": {
      "country_name": "Norway",
      "iban_structure": "NO2!n4!n6!n1!n",
      "bban_structure": "4!n6!n1!n",
      "iban_regex": "/^NO\\\\d{2}\\\\d{4}\\\\d{6}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{6}\\\\d{1}$/",
      "iban_length": 15,
      "bban_length": 11,
      "iban_electronic_format_example": "NO9386011117947",
      "iban_print_format_example": "NO93 8601 1117 947",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "OM": {
      "country_name": "Oman",
      "iban_structure": "OM2!n3!n16!c",
      "bban_structure": "3!n16!c",
      "iban_regex": "/^OM\\\\d{2}\\\\d{3}[A-Z0-9]{16}$/",
      "bban_regex": "/^\\\\d{3}[A-Z0-9]{16}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "OM830001101001234567891",
      "iban_print_format_example": "OM83 0001 1010 0123 4567 891",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "PL": {
      "country_name": "Poland",
      "iban_structure": "PL2!n8!n16!n",
      "bban_structure": "8!n16!n",
      "iban_regex": "/^PL\\\\d{2}\\\\d{8}\\\\d{16}$/",
      "bban_regex": "/^\\\\d{8}\\\\d{16}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "PL61109010140000071219812874",
      "iban_print_format_example": "PL61 1090 1014 0000 0712 1981 2874",
      "bank_identifier_position": "1-8",
      "bank_identifier_structure": "8!n",
      "bank_identifier_regex": "/^\\\\d{8}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "PS": {
      "country_name": "Palestine, State of",
      "iban_structure": "PS2!n4!a21!c",
      "bban_structure": "4!a21!c",
      "iban_regex": "/^PS\\\\d{2}[A-Z]{4}[A-Z0-9]{21}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{21}$/",
      "iban_length": 29,
      "bban_length": 25,
      "iban_electronic_format_example": "PS92PALS000000000400123456702",
      "iban_print_format_example": "PS92 PALS 0000 0000 0400 1234 5670 2",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "PT": {
      "country_name": "Portugal",
      "iban_structure": "PT2!n4!n4!n11!n2!n",
      "bban_structure": "4!n4!n11!n2!n",
      "iban_regex": "/^PT\\\\d{2}\\\\d{4}\\\\d{4}\\\\d{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{4}\\\\d{11}\\\\d{2}$/",
      "iban_length": 25,
      "bban_length": 21,
      "iban_electronic_format_example": "PT50000201231234567890154",
      "iban_print_format_example": "PT50 0002 0123 1234 5678 9015 4",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "QA": {
      "country_name": "Qatar",
      "iban_structure": "QA2!n4!a21!c",
      "bban_structure": "4!a21!c",
      "iban_regex": "/^QA\\\\d{2}[A-Z]{4}[A-Z0-9]{21}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{21}$/",
      "iban_length": 29,
      "bban_length": 25,
      "iban_electronic_format_example": "QA58DOHB00001234567890ABCDEFG",
      "iban_print_format_example": "QA58 DOHB 0000 1234 5678 90AB CDEF G",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "RO": {
      "country_name": "Romania",
      "iban_structure": "RO2!n4!a16!c",
      "bban_structure": "4!a16!c",
      "iban_regex": "/^RO\\\\d{2}[A-Z]{4}[A-Z0-9]{16}$/",
      "bban_regex": "/^[A-Z]{4}[A-Z0-9]{16}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "RO49AAAA1B31007593840000",
      "iban_print_format_example": "RO49 AAAA 1B31 0075 9384 0000",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "RS": {
      "country_name": "Serbia",
      "iban_structure": "RS2!n3!n13!n2!n",
      "bban_structure": "3!n13!n2!n",
      "iban_regex": "/^RS\\\\d{2}\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "RS35260005601001611379",
      "iban_print_format_example": "RS35 2600 0560 1001 6113 79",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "RU": {
      "country_name": "Russia",
      "iban_structure": "RU2!n9!n5!n15!c",
      "bban_structure": "9!n5!n15!c",
      "iban_regex": "/^RU\\\\d{2}\\\\d{9}\\\\d{5}[A-Z0-9]{15}$/",
      "bban_regex": "/^\\\\d{9}\\\\d{5}[A-Z0-9]{15}$/",
      "iban_length": 33,
      "bban_length": 29,
      "iban_electronic_format_example": "RU020445252254081781038091310419",
      "iban_print_format_example": "RU02 0445 2522 5408 1781 0380 9131 0419",
      "bank_identifier_position": "1-9",
      "bank_identifier_structure": "9!n",
      "bank_identifier_regex": "/^\\\\d{9}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SA": {
      "country_name": "Saudi Arabia",
      "iban_structure": "SA2!n2!n18!c",
      "bban_structure": "2!n18!c",
      "iban_regex": "/^SA\\\\d{2}\\\\d{2}[A-Z0-9]{18}$/",
      "bban_regex": "/^\\\\d{2}[A-Z0-9]{18}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "SA0380000000608010167519",
      "iban_print_format_example": "SA03 8000 0000 6080 1016 7519",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SC": {
      "country_name": "Seychelles",
      "iban_structure": "SC2!n4!a2!n2!n16!n3!a",
      "bban_structure": "4!a2!n2!n16!n3!a",
      "iban_regex": "/^SC\\\\d{2}[A-Z]{4}\\\\d{2}\\\\d{2}\\\\d{16}\\\\d{3}[A-Z]{3}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{2}\\\\d{2}\\\\d{16}\\\\d{3}[A-Z]{3}$/",
      "iban_length": 31,
      "bban_length": 27,
      "iban_electronic_format_example": "SC18SSCB11010000000000001497USD",
      "iban_print_format_example": "SC18 SSCB 1101 0000 0000 0001 497U SD",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "7-8",
      "branch_identifier_structure": "2!n",
      "branch_identifier_regex": "/^\\\\d{2}$/"
    },
    "SD": {
      "country_name": "Sudan",
      "iban_structure": "SD2!n2!n12!n",
      "bban_structure": "2!n12!n",
      "iban_regex": "/^SD\\\\d{2}\\\\d{2}\\\\d{12}$/",
      "bban_regex": "/^\\\\d{2}\\\\d{12}$/",
      "iban_length": 18,
      "bban_length": 14,
      "iban_electronic_format_example": "SD8811123456789012",
      "iban_print_format_example": "SD88 1112 3456 7890 12",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SE": {
      "country_name": "Sweden",
      "iban_structure": "SE2!n3!n16!n1!n",
      "bban_structure": "3!n16!n1!n",
      "iban_regex": "/^SE\\\\d{2}\\\\d{3}\\\\d{16}\\\\d{1}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{16}\\\\d{1}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "SE4550000000058398257466",
      "iban_print_format_example": "SE45 5000 0000 0583 9825 7466",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SI": {
      "country_name": "Slovenia",
      "iban_structure": "SI2!n5!n8!n2!n",
      "bban_structure": "5!n8!n2!n",
      "iban_regex": "/^SI\\\\d{2}\\\\d{5}\\\\d{8}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{8}\\\\d{2}$/",
      "iban_length": 19,
      "bban_length": 15,
      "iban_electronic_format_example": "SI56192001234567892",
      "iban_print_format_example": "SI56 1920 0123 4567 892",
      "bank_identifier_position": "1-5 1-4",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SK": {
      "country_name": "Slovakia",
      "iban_structure": "SK2!n4!n6!n10!n",
      "bban_structure": "4!n6!n10!n",
      "iban_regex": "/^SK\\\\d{2}\\\\d{4}\\\\d{6}\\\\d{10}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{6}\\\\d{10}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "SK3112000000198742637541",
      "iban_print_format_example": "SK31 1200 0000 1987 4263 7541",
      "bank_identifier_position": "2-6",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "SM": {
      "country_name": "San Marino",
      "iban_structure": "SM2!n1!a5!n5!n12!c",
      "bban_structure": "1!a5!n5!n12!c",
      "iban_regex": "/^SM\\\\d{2}[A-Z]{1}\\\\d{5}\\\\d{5}[A-Z0-9]{12}$/",
      "bban_regex": "/^[A-Z]{1}\\\\d{5}\\\\d{5}[A-Z0-9]{12}$/",
      "iban_length": 27,
      "bban_length": 23,
      "iban_electronic_format_example": "SM86U0322509800000000270100",
      "iban_print_format_example": "SM86 U032 2509 8000 0000 0270 100",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "7-11",
      "branch_identifier_structure": "5!n",
      "branch_identifier_regex": "/^\\\\d{5}$/"
    },
    "SO": {
      "country_name": "Somalia",
      "iban_structure": "SO2!n4!n3!n12!n",
      "bban_structure": "4!n3!n12!n",
      "iban_regex": "/^SO\\\\d{2}\\\\d{4}\\\\d{3}\\\\d{12}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{3}\\\\d{12}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "SO211000001001000100141",
      "iban_print_format_example": "SO21 1000 0010 0100 0100 141",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "5-7",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "ST": {
      "country_name": "Sao Tome and Principe",
      "iban_structure": "ST2!n4!n4!n11!n2!n",
      "bban_structure": "4!n4!n11!n2!n",
      "iban_regex": "/^ST\\\\d{2}\\\\d{4}\\\\d{4}\\\\d{11}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{4}\\\\d{11}\\\\d{2}$/",
      "iban_length": 25,
      "bban_length": 21,
      "iban_electronic_format_example": "ST68000200010192194210112",
      "iban_print_format_example": "ST68 0002 0001 0192 1942 1011 2",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "4!n",
      "bank_identifier_regex": "/^\\\\d{4}$/",
      "branch_identifier_position": "5-8",
      "branch_identifier_structure": "4!n",
      "branch_identifier_regex": "/^\\\\d{4}$/"
    },
    "SV": {
      "country_name": "El Salvador",
      "iban_structure": "SV2!n4!a20!n",
      "bban_structure": "4!a20!n",
      "iban_regex": "/^SV\\\\d{2}[A-Z]{4}\\\\d{20}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{20}$/",
      "iban_length": 28,
      "bban_length": 24,
      "iban_electronic_format_example": "SV62CENR00000000000000700025",
      "iban_print_format_example": "SV62 CENR 0000 0000 0000 0700 025",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "TL": {
      "country_name": "Timor-Leste",
      "iban_structure": "TL2!n3!n14!n2!n",
      "bban_structure": "3!n14!n2!n",
      "iban_regex": "/^TL\\\\d{2}\\\\d{3}\\\\d{14}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{14}\\\\d{2}$/",
      "iban_length": 23,
      "bban_length": 19,
      "iban_electronic_format_example": "TL380080012345678910157",
      "iban_print_format_example": "TL38 0080 0123 4567 8910 157",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "TN": {
      "country_name": "Tunisia",
      "iban_structure": "TN2!n2!n3!n13!n2!n",
      "bban_structure": "2!n3!n13!n2!n",
      "iban_regex": "/^TN\\\\d{2}\\\\d{2}\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{2}\\\\d{3}\\\\d{13}\\\\d{2}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "TN5910006035183598478831",
      "iban_print_format_example": "TN59 1000 6035 1835 9847 8831",
      "bank_identifier_position": "1-5",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "3-5",
      "branch_identifier_structure": "3!n",
      "branch_identifier_regex": "/^\\\\d{3}$/"
    },
    "TR": {
      "country_name": "Turkey",
      "iban_structure": "TR2!n5!n1!n16!c",
      "bban_structure": "5!n1!n16!c",
      "iban_regex": "/^TR\\\\d{2}\\\\d{5}\\\\d{1}[A-Z0-9]{16}$/",
      "bban_regex": "/^\\\\d{5}\\\\d{1}[A-Z0-9]{16}$/",
      "iban_length": 26,
      "bban_length": 22,
      "iban_electronic_format_example": "TR330006100519786457841326",
      "iban_print_format_example": "TR33 0006 1005 1978 6457 8413 26",
      "bank_identifier_position": "1-6",
      "bank_identifier_structure": "5!n",
      "bank_identifier_regex": "/^\\\\d{5}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "UA": {
      "country_name": "Ukraine",
      "iban_structure": "UA2!n6!n19!c",
      "bban_structure": "6!n19!c",
      "iban_regex": "/^UA\\\\d{2}\\\\d{6}[A-Z0-9]{19}$/",
      "bban_regex": "/^\\\\d{6}[A-Z0-9]{19}$/",
      "iban_length": 29,
      "bban_length": 25,
      "iban_electronic_format_example": "UA213223130000026007233566001",
      "iban_print_format_example": "UA21 3223 1300 0002 6007 2335 6600 1",
      "bank_identifier_position": "1-3",
      "bank_identifier_structure": "6!n",
      "bank_identifier_regex": "/^\\\\d{6}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "VA": {
      "country_name": "Vatican City State",
      "iban_structure": "VA2!n3!n15!n",
      "bban_structure": "3!n15!n",
      "iban_regex": "/^VA\\\\d{2}\\\\d{3}\\\\d{15}$/",
      "bban_regex": "/^\\\\d{3}\\\\d{15}$/",
      "iban_length": 22,
      "bban_length": 18,
      "iban_electronic_format_example": "VA59001123000012345678",
      "iban_print_format_example": "VA59 001 1230 0001 2345 678",
      "bank_identifier_position": "1-4",
      "bank_identifier_structure": "3!n",
      "bank_identifier_regex": "/^\\\\d{3}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "VG": {
      "country_name": "Virgin Islands",
      "iban_structure": "VG2!n4!a16!n",
      "bban_structure": "4!a16!n",
      "iban_regex": "/^VG\\\\d{2}[A-Z]{4}\\\\d{16}$/",
      "bban_regex": "/^[A-Z]{4}\\\\d{16}$/",
      "iban_length": 24,
      "bban_length": 20,
      "iban_electronic_format_example": "VG96VPVG0000012345678901",
      "iban_print_format_example": "VG96 VPVG 0000 0123 4567 8901",
      "bank_identifier_position": "1-2",
      "bank_identifier_structure": "4!a",
      "bank_identifier_regex": "/^[A-Z]{4}$/",
      "branch_identifier_position": "",
      "branch_identifier_structure": "",
      "branch_identifier_regex": ""
    },
    "XK": {
      "country_name": "Kosovo",
      "iban_structure": "XK2!n4!n10!n2!n",
      "bban_structure": "4!n10!n2!n",
      "iban_regex": "/^XK\\\\d{2}\\\\d{4}\\\\d{10}\\\\d{2}$/",
      "bban_regex": "/^\\\\d{4}\\\\d{10}\\\\d{2}$/",
      "iban_length": 20,
      "bban_length": 16,
      "iban_electronic_format_example": "XK051212012345678906",
      "iban_print_format_example": "XK05 1212 0123 4567 8906",
      "bank_identifier_position": "",
      "bank_identifier_structure": "2!n",
      "bank_identifier_regex": "/^\\\\d{2}$/",
      "branch_identifier_position": "3-4",
      "branch_identifier_structure": "2!n",
      "branch_identifier_regex": "/^\\\\d{2}$/"
    }
  };

  function normalizeIbanInput(iban) {
    const normalized = normalizeSpace(iban).toUpperCase();
    return normalized.replace(/^I?IBAN/, "").replace(/[^A-Z0-9]/g, "");
  }

  function formatIbanPrint(iban) {
    if (!iban) return "";
    return iban.match(/.{1,4}/g)?.join(" ") || iban;
  }

  function parseRegistryRegex(regexString) {
    if (!regexString) return null;
    if (regexString.startsWith("/") && regexString.lastIndexOf("/") > 0) {
      const lastSlash = regexString.lastIndexOf("/");
      const body = regexString.slice(1, lastSlash);
      const flags = regexString.slice(lastSlash + 1);
      return new RegExp(body, flags);
    }
    return new RegExp(regexString);
  }

  function getRegistryEntry(countryCode) {
    return IBAN_REGISTRY[countryCode] || null;
  }

  function parsePositionRange(position) {
    if (!position) return null;
    const first = position.split(" ")[0];
    const [start, end] = first.split("-").map((value) => Number.parseInt(value, 10));
    if (!Number.isFinite(start)) return null;
    const safeEnd = Number.isFinite(end) ? end : start;
    return { start: start - 1, end: safeEnd };
  }

  function extractSegment(bban, position) {
    const range = parsePositionRange(position);
    if (!range || !bban) return "";
    return bban.slice(range.start, range.end);
  }

  function mod97ForIban(input) {
    let remainder = 0;
    for (const char of input) {
      if (char >= "A" && char <= "Z") {
        const value = char.charCodeAt(0) - 55;
        for (const digit of String(value)) {
          remainder = (remainder * 10 + Number(digit)) % 97;
        }
      } else if (char >= "0" && char <= "9") {
        remainder = (remainder * 10 + Number(char)) % 97;
      }
    }
    return remainder;
  }

  function computeChecksum(countryCode, bban) {
    const rearranged = `${bban}${countryCode}00`;
    const mod = mod97ForIban(rearranged);
    return String(98 - mod).padStart(2, "0");
  }

  function validateIbanChecksum(normalized) {
    const countryCode = normalized.slice(0, 2);
    const checksum = normalized.slice(2, 4);
    const bban = normalized.slice(4);
    const expectedChecksum = computeChecksum(countryCode, bban);
    const remainder = mod97ForIban(`${bban}${countryCode}${checksum}`);
    return {
      valid: remainder === 1,
      expectedChecksum,
      remainder
    };
  }

  function buildIbanDetails(iban, bankName = "") {
    const normalized = normalizeIbanInput(iban);
    if (!normalized) {
      return [["IBAN ellenőrzés", "Nincs megadott IBAN."]];
    }

    const countryCode = normalized.slice(0, 2);
    const checksum = normalized.slice(2, 4);
    const bban = normalized.slice(4);
    const entry = getRegistryEntry(countryCode);
    const details = [
      ["IBAN (print formátum)", formatIbanPrint(normalized)],
      ["Országkód", countryCode],
      ["Bank neve", bankName || "N/A"],
      ["Ellenőrző szám", checksum],
      ["BBAN", bban]
    ];

    if (!entry) {
      details.push(
        ["Ország", "Ismeretlen"],
        ["IBAN hossz", `${normalized.length} / N/A`],
        ["BBAN hossz", `${bban.length} / N/A`],
        ["Bank azonosító pozíció", "N/A"],
        ["Bank azonosító érték", "N/A"],
        ["Fiók azonosító pozíció", "N/A"],
        ["Fiók azonosító érték", "N/A"],
        ["Ellenőrző szám (számolt)", "N/A"],
        ["Mod97 eredmény", "N/A"],
        ["Érvényes IBAN", "Nem"],
        ["Hibák", "Ismeretlen országkód"]
      );
      return details;
    }

    const ibanRegex = parseRegistryRegex(entry.iban_regex);
    const bbanRegex = parseRegistryRegex(entry.bban_regex);
    const lengthOk = normalized.length === entry.iban_length;
    const bbanLengthOk = bban.length === entry.bban_length;
    let formatOk = ibanRegex ? ibanRegex.test(normalized) : false;
    let bbanFormatOk = bbanRegex ? bbanRegex.test(bban) : false;
    const ibanNumericOnly = entry.iban_structure && !/![ac]/.test(entry.iban_structure);
    const bbanNumericOnly = entry.bban_structure && !/![ac]/.test(entry.bban_structure);

    if (!formatOk && ibanNumericOnly && lengthOk && /^[A-Z]{2}\d+$/.test(normalized)) {
      formatOk = true;
    }
    if (!bbanFormatOk && bbanNumericOnly && bbanLengthOk && /^\d+$/.test(bban)) {
      bbanFormatOk = true;
    }
    const checksumInfo = validateIbanChecksum(normalized);
    const bankId = extractSegment(bban, entry.bank_identifier_position);
    const branchId = extractSegment(bban, entry.branch_identifier_position);
    const isValid = lengthOk && formatOk && checksumInfo.valid;
    const issues = [];

    if (!lengthOk) issues.push(`Hossz hibás (várt: ${entry.iban_length})`);
    if (!formatOk) issues.push("Formátum nem megfelelő");
    if (!checksumInfo.valid) issues.push(`Checksum hibás (várt: ${checksumInfo.expectedChecksum})`);
    if (!bbanLengthOk) issues.push(`BBAN hossz hibás (várt: ${entry.bban_length})`);
    if (!bbanFormatOk) issues.push("BBAN formátum nem megfelelő");

    details.push(
      ["Ország", entry.country_name],
      ["IBAN hossz", `${normalized.length} / ${entry.iban_length}`],
      ["BBAN hossz", `${bban.length} / ${entry.bban_length}`],
      ["Bank azonosító pozíció", entry.bank_identifier_position || "N/A"],
      ["Bank azonosító érték", bankId || "N/A"],
      ["Fiók azonosító pozíció", entry.branch_identifier_position || "N/A"],
      ["Fiók azonosító érték", branchId || "N/A"],
      ["Ellenőrző szám (számolt)", checksumInfo.expectedChecksum],
      ["Mod97 eredmény", String(checksumInfo.remainder)],
      ["Érvényes IBAN", isValid ? "Igen" : "Nem"],
      ["Hibák", issues.length ? issues.join("; ") : "Nincs"]
    );

    return details;
  }

  function requestIbanChecker(iban, bankName) {
    return Promise.resolve(buildIbanDetails(iban, bankName));
  }

  function normalizeAccount(account) {
    return normalizeSpace(account).replace(/[^0-9a-z]/gi, "");
  }

  function parseIbanFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tds = Array.from(doc.querySelectorAll("#results table td"));
    for (let i = 0; i < tds.length; i++) {
      if (normalizeSpace(tds[i].textContent) === "IBAN") {
        return normalizeSpace(tds[i + 1]?.childNodes?.[0]?.textContent || tds[i + 1]?.textContent || "");
      }
    }
    return "";
  }

  function requestIbanFromCalculator(account, countryCode = DEFAULT_IBAN_COUNTRY) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        resolve("");
        return;
      }
      const url = new URL("https://www.iban.hu/calculate-iban");
      url.searchParams.set("requestId", buildRequestId());
      const data = new URLSearchParams({ country: countryCode, account }).toString();
      GM_xmlhttpRequest({
        method: "POST",
        url: url.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        anonymous: true,
        data,
        onload: (response) => resolve(parseIbanFromHtml(response.responseText || "")),
        onerror: () => resolve("")
      });
    });
  }

  function buildRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function calculateIbans(accounts) {
    const results = new Map();
    for (const accountEntry of accounts) {
      const normalized = normalizeAccount(accountEntry.account).toUpperCase();
      if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
        results.set(accountEntry.account, normalized);
        continue;
      }
      const iban = await requestIbanFromCalculator(normalized, DEFAULT_IBAN_COUNTRY);
      results.set(accountEntry.account, iban || "IBAN számítás sikertelen");
    }
    return results;
  }

  // -------------------------
  // Data loader (fetch other pages)
  // -------------------------
  function getCacheKey() {
    const doc = document;
    return getEidFromUrl()
      || getEidFromDoc(doc)
      || getIdentifierFromLinks(doc)
      || normalizeRegistryNumber(readRegistryNumberFromDoc(doc))
      || window.location.href;
  }

  function getIdentifierFromLinks(root) {
    const link = root.querySelector("a[href*='/cegtar/cegadatlap/'], a[href*='/cegtar/cegriport/'], a[href*='/cegtar/kapcsolati-halo/']");
    if (!link) return "";
    const href = link.getAttribute("href") || "";
    const match = href.match(/\/cegtar\/(?:cegadatlap|cegriport|kapcsolati-halo)\/([^/?#]+)/i);
    return match ? match[1] : "";
  }

  function getEidFromDataAttributes(root) {
    const byRoot = root.querySelector("#root[data-id]")?.getAttribute("data-id");
    if (byRoot && /^\d+$/.test(byRoot)) return `eid${byRoot}`;
    const byKhra = root.querySelector("#khra[data-eid]")?.getAttribute("data-eid");
    if (byKhra && /^\d+$/.test(byKhra)) return `eid${byKhra}`;
    const anyEid = root.querySelector("[data-eid]")?.getAttribute("data-eid");
    if (anyEid && /^\d+$/.test(anyEid)) return `eid${anyEid}`;
    return "";
  }

  function getEidFromDoc(root) {
    const fromCanonical = (() => {
      const canonical = root.querySelector("link[rel='canonical']")?.href || "";
      const match = canonical.match(/eid\d+/i);
      return match ? match[0] : "";
    })();
    if (fromCanonical) return fromCanonical;
    return getEidFromDataAttributes(root);
  }

  function buildOptenUrl(section, identifier) {
    if (!identifier) return "";
    return `https://www.opten.hu/cegtar/${section}/${identifier}`;
  }

  async function loadAllData() {
    const currentDoc = document;
    const baseFromPage = parseCegadatlap(currentDoc);
    const base = baseFromPage;

    const registryNumberDigits =
      normalizeRegistryNumber(base.registryNumber) ||
      normalizeRegistryNumber(readRegistryNumberFromDoc(currentDoc));
    const eid = getEidFromUrl() || getEidFromDoc(currentDoc);
    const identifier = eid || registryNumberDigits || getIdentifierFromLinks(currentDoc);

    const cegadatlapUrl = buildOptenUrl("cegadatlap", identifier);
    const cegriportUrl = buildOptenUrl("cegriport", identifier);
    const kapcsolatiHaloUrl = buildOptenUrl("kapcsolati-halo", identifier);

    const results = { base, report: {}, halo: {} };
    const requests = [];
    const eidNumber = getEidNumber(eid || identifier);

    if (window.location.pathname.includes("/cegtar/cegadatlap/")) {
      results.base = baseFromPage;
      if (!hasCegadatlapData(baseFromPage) && cegadatlapUrl) {
        requests.push(
          requestHtml(cegadatlapUrl)
            .then((html) => parseCegadatlap(htmlToDocument(html)))
            .then((data) => { results.base = { ...results.base, ...data }; })
            .catch(() => {})
        );
      }
    } else if (cegadatlapUrl) {
      requests.push(
        requestHtml(cegadatlapUrl)
          .then((html) => parseCegadatlap(htmlToDocument(html)))
          .then((data) => { results.base = { ...results.base, ...data }; })
          .catch(() => {})
      );
    }

    if (window.location.pathname.includes("/cegtar/cegriport/")) {
      const reportFromPage = parseCegriport(currentDoc) || {};
      results.report = reportFromPage;
      if (!hasReportData(reportFromPage) && cegriportUrl) {
        requests.push(
          requestHtml(cegriportUrl)
            .then((html) => parseCegriport(htmlToDocument(html)))
            .then((data) => { results.report = data || {}; })
            .catch(() => {})
        );
      }
    } else if (cegriportUrl) {
      requests.push(
        requestHtml(cegriportUrl)
          .then((html) => parseCegriport(htmlToDocument(html)))
          .then((data) => { results.report = data || {}; })
          .catch(() => {})
      );
    }

    if (window.location.pathname.includes("/cegtar/kapcsolati-halo/")) {
      const haloFromPage = parseKapcsolatiHalo(currentDoc) || {};
      results.halo = haloFromPage;
      if (!hasHaloData(haloFromPage) && kapcsolatiHaloUrl) {
        requests.push(
          requestHtml(kapcsolatiHaloUrl)
            .then((html) => parseKapcsolatiHalo(htmlToDocument(html)))
            .then((data) => { results.halo = data || {}; })
            .catch(() => {})
        );
      }
    } else if (kapcsolatiHaloUrl) {
      requests.push(
        requestHtml(kapcsolatiHaloUrl)
          .then((html) => parseKapcsolatiHalo(htmlToDocument(html)))
          .then((data) => { results.halo = data || {}; })
          .catch(() => {})
      );
    }

    if ((!hasHaloData(results.halo)) && eidNumber) {
      const payload = buildKapcsolatiHaloPayload(eidNumber);
      if (payload) {
        requests.push(
          requestJson("/cegtar/kapcsolati-halo-api", payload)
            .then((data) => parseKapcsolatiHaloResponse(data || {}))
            .then((data) => { results.halo = { ...results.halo, ...data }; })
            .catch(() => {})
        );
      }
    }

    await Promise.all(requests);

    const merged = {
      ...results.base,
      ...results.report,
      ...results.halo,
      eid: eid || base.eid,
      sourceUrl: window.location.href
    };

    if (!merged.kapcsolatok && results.halo?.kapcsolatok) {
      merged.kapcsolatok = results.halo.kapcsolatok;
    }
    if (!merged.corporateOwnersCount && results.halo?.corporateOwnersCount) {
      merged.corporateOwnersCount = results.halo.corporateOwnersCount;
    }

    return merged;
  }

  async function getAllData() {
    const key = getCacheKey();
    if (cachedData && cachedDataKey === key) return cachedData;
    if (cachedDataPromise && cachedDataKey === key) return cachedDataPromise;

    cachedDataKey = key;
    cachedDataPromise = loadAllData().then((data) => {
      cachedData = data;
      return data;
    });

    return cachedDataPromise;
  }

  // -------------------------
  // Drawer UI
  // -------------------------
  function ensureDrawer() {
    if (document.getElementById(DRAWER_IDS.drawer)) return;

    const style = document.createElement("style");
    style.textContent = `
      :root { --teya-z: 999999; }
      .teya-onb-backdrop{
        position: fixed; inset: 0; background: rgba(0,0,0,.35);
        z-index: var(--teya-z); display:none;
      }
      .teya-onb-backdrop.show{ display:block; }
      .teya-onb-drawer{
        position: fixed; top: 0; right: 0; height: 100vh; width: min(840px, 96vw);
        background: #fff; box-shadow: -16px 0 40px rgba(0,0,0,.22);
        z-index: calc(var(--teya-z) + 1);
        transform: translateX(100%);
        transition: transform .18s ease-out;
        display:flex; flex-direction:column;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .teya-onb-drawer.show{ transform: translateX(0); }
      .teya-onb-header{
        display:flex; align-items:flex-start; justify-content:space-between;
        gap: 12px; padding: 14px 16px;
        border-bottom: 1px solid #e7e7e7;
      }
      .teya-onb-title{ display:flex; flex-direction:column; gap: 6px; min-width: 0; }
      .teya-onb-title h2{
        margin: 0; font-size: 16px; font-weight: 700;
        letter-spacing: .2px; color:#111; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
      }
      .teya-onb-sub{
        font-size: 12px; color:#555; display:flex; flex-wrap:wrap; gap: 10px;
      }
      .teya-onb-close{
        border: 1px solid #ddd; background: #fff;
        border-radius: 10px; width: 36px; height: 36px;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        flex: 0 0 auto;
      }
      .teya-onb-close:hover{ background:#f6f6f6; }
      .teya-onb-body{ padding: 14px 16px 24px; overflow:auto; }
      .teya-section{
        border: 1px solid #eee; border-radius: 12px; margin-bottom: 16px;
        overflow:hidden; background: #fff;
      }
      .teya-section-head{
        display:flex; justify-content:space-between; align-items:center;
        padding: 10px 12px; background:#fafafa; border-bottom:1px solid #eee;
        font-weight:600; font-size:13px;
      }
      .teya-row{
        display:grid; grid-template-columns: 190px 1fr 44px;
        gap: 10px; padding: 10px 12px; align-items:center;
        border-bottom: 1px solid #f0f0f0;
      }
      .teya-row:last-child{ border-bottom: none; }
      .teya-label{ font-size: 12px; color:#333; }
      .teya-value{
        width: 100%; border:1px solid #e2e2e2; border-radius: 8px;
        padding: 8px 10px; font-size: 13px; color:#111; background:#fff;
      }
      .teya-value[readonly]{ background:#fafafa; }
      .teya-value-wrap{ display:flex; flex-direction:column; gap: 4px; }
      .teya-value-note{ font-size: 11px; color:#777; }
      .teya-copy{
        border: 1px solid #ddd; background: #fff; border-radius: 10px;
        width: 36px; height: 36px; cursor:pointer; display:flex;
        align-items:center; justify-content:center;
      }
      .teya-copy:hover{ background:#f6f6f6; }
      .teya-toolbar{ display:flex; flex-wrap:wrap; gap: 8px; margin-top: 4px; }
      .teya-btn{
        border-radius: 10px; padding: 8px 12px; border:1px solid #d6d6d6;
        background:#fff; cursor:pointer; font-size: 13px;
      }
      .teya-btn.primary{ background:#0d6efd; color:#fff; border-color:#0d6efd; }
      .teya-toast{
        position: fixed; right: 20px; bottom: 18px; background: #111; color:#fff;
        padding: 10px 14px; border-radius: 10px; font-size: 12px;
        opacity: 0; transform: translateY(8px);
        transition: opacity .2s ease, transform .2s ease;
        z-index: calc(var(--teya-z) + 2);
      }
      .teya-toast.show{ opacity: 1; transform: translateY(0); }
      @media (max-width: 720px){
        .teya-row{ grid-template-columns: 1fr 44px; }
        .teya-label{ grid-column: 1 / -1; padding-top:0; }
      }
    `.trim();

    const backdrop = document.createElement("div");
    backdrop.id = DRAWER_IDS.backdrop;
    backdrop.className = "teya-onb-backdrop";

    const drawer = document.createElement("aside");
    drawer.id = DRAWER_IDS.drawer;
    drawer.className = "teya-onb-drawer";
    drawer.innerHTML = `
      <div class="teya-onb-header">
        <div class="teya-onb-title">
          <h2 id="${DRAWER_IDS.title}">Teya Onboarding</h2>
          <div class="teya-onb-sub" id="${DRAWER_IDS.sub}"></div>
          <div class="teya-toolbar">
            <button class="teya-btn primary" id="teya_copy_json">Copy JSON</button>
            <button class="teya-btn" id="teya_copy_block">Copy onboarding blokk</button>
            <button class="teya-btn" id="teya_open_teya" ${TEYA_ONBOARDING_BASE_URL ? "" : "disabled"}>Megnyitás Teya Onboardingban</button>
          </div>
        </div>
        <button class="teya-onb-close" id="teya-onb-close" title="Bezárás (Esc)">
          <span style="font-size:18px; line-height:18px;">×</span>
        </button>
      </div>
      <div class="teya-onb-body" id="${DRAWER_IDS.body}"></div>
    `.trim();

    const toast = document.createElement("div");
    toast.id = DRAWER_IDS.toast;
    toast.className = "teya-toast";

    document.head.appendChild(style);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(toast);

    function closeDrawer() {
      document.getElementById(DRAWER_IDS.drawer)?.classList.remove("show");
      document.getElementById(DRAWER_IDS.backdrop)?.classList.remove("show");
    }

    document.getElementById("teya-onb-close").addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });

    drawer.addEventListener("click", (event) => {
      const button = event.target.closest(".teya-copy");
      if (!button) return;
      const row = button.closest(".teya-row");
      const input = row?.querySelector(".teya-value");
      if (!input) return;
      const ok = safeCopy(input.value || "");
      showToast(ok ? "Másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_json").addEventListener("click", async () => {
      const payload = await collectPayload();
      const ok = safeCopy(JSON.stringify(payload, null, 2));
      showToast(ok ? "JSON másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_block").addEventListener("click", async () => {
      const payload = await collectPayload();
      const lines = Object.entries(payload)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => `${key}: ${value}`);
      const ok = safeCopy(lines.join("\n"));
      showToast(ok ? "Onboarding blokk másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_open_teya").addEventListener("click", async () => {
      if (!TEYA_ONBOARDING_BASE_URL) return;
      const payload = await collectPayload();
      const url = new URL(TEYA_ONBOARDING_BASE_URL);
      Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value || ""));
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });
  }

  function showToast(message) {
    const toast = document.getElementById(DRAWER_IDS.toast);
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  function renderLoading() {
    const body = document.getElementById(DRAWER_IDS.body);
    if (!body) return;
    body.innerHTML = `
      <div class="teya-section">
        <div class="teya-section-head">Betöltés</div>
        <div class="teya-row">
          <div class="teya-label">Állapot</div>
          <input class="teya-value" type="text" readonly value="Adatok betöltése folyamatban..." />
          <button class="teya-copy" title="Másolás" disabled>…</button>
        </div>
      </div>
    `.trim();
  }

  function buildRow(label, value, { multiline = false, id } = {}) {
    const row = document.createElement("div");
    row.className = "teya-row";

    const labelEl = document.createElement("div");
    labelEl.className = "teya-label";
    labelEl.textContent = label;

    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.className = "teya-value";
    input.readOnly = true;
    input.value = value || "";
    if (multiline) input.rows = Math.min(8, Math.max(3, input.value.split("\n").length));
    else input.type = "text";
    if (id) input.id = id;

    const valueWrap = document.createElement("div");
    valueWrap.className = "teya-value-wrap";
    valueWrap.appendChild(input);

    const forintText = formatForintText(label, input.value);
    if (forintText) {
      const note = document.createElement("div");
      note.className = "teya-value-note";
      note.textContent = forintText;
      valueWrap.appendChild(note);
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "teya-copy";
    copyBtn.title = "Másolás";
    copyBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z"></path>
      </svg>
    `.trim();

    row.appendChild(labelEl);
    row.appendChild(valueWrap);
    row.appendChild(copyBtn);
    return row;
  }

  function buildSection(title, rows) {
    const section = document.createElement("div");
    section.className = "teya-section";
    const header = document.createElement("div");
    header.className = "teya-section-head";
    header.textContent = title;
    section.appendChild(header);
    rows.forEach((row) => section.appendChild(row));
    return section;
  }

  function formatForintText(label, value) {
    if (!value) return "";
    const normalizedLabel = normalizeSpace(label).toLowerCase();
    const forintLabels = [
      "árbevétel",
      "kártyás nettó havi árbevétele"
    ];
    const isForintField = forintLabels.some((item) => normalizedLabel.includes(item));
    if (!isForintField) return "";
    const digits = extractDigits(value);
    if (!digits) return "";
    const amount = Number.parseInt(digits, 10);
    if (!Number.isFinite(amount)) return "";
    return `${numberToHungarianWords(amount)} forint`;
  }

  function numberToHungarianWords(value) {
    if (value === 0) return "nulla";
    const scales = ["", "ezer", "millió", "milliárd", "billió"];
    const parts = [];
    let remaining = value;
    let scaleIndex = 0;

    while (remaining > 0 && scaleIndex < scales.length) {
      const chunk = remaining % 1000;
      if (chunk) {
        const chunkWords = chunkToHungarianWords(chunk);
        const scaleWord = scales[scaleIndex];
        parts.unshift([chunkWords, scaleWord].filter(Boolean).join(" "));
      }
      remaining = Math.floor(remaining / 1000);
      scaleIndex += 1;
    }

    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function chunkToHungarianWords(value) {
    const ones = ["", "egy", "kettő", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"];
    const compoundOnes = ["", "egy", "két", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"];
    const tens = ["", "tíz", "húsz", "harminc", "negyven", "ötven", "hatvan", "hetven", "nyolcvan", "kilencven"];

    const hundred = Math.floor(value / 100);
    const rest = value % 100;
    let result = "";

    if (hundred) {
      result += hundred === 1 ? "száz" : `${compoundOnes[hundred]}száz`;
    }

    if (rest) {
      if (rest < 10) {
        result += ones[rest];
      } else if (rest < 20) {
        result += rest === 10 ? "tíz" : `tizen${ones[rest - 10]}`;
      } else if (rest < 30) {
        result += rest === 20 ? "húsz" : `huszon${ones[rest - 20]}`;
      } else {
        const ten = Math.floor(rest / 10);
        const unit = rest % 10;
        result += tens[ten];
        if (unit) result += ones[unit];
      }
    }

    return result;
  }

  function listActivities(activities) {
    return Array.isArray(activities) ? activities.filter(Boolean).join("\n") : (activities || "");
  }

  function formatGroupedActivities(grouped, activities) {
    if (!grouped || grouped.size === 0) return listActivities(activities);
    return Array.from(grouped.entries())
      .map(([category, items]) => {
        const rows = items.map((item) => `- ${item}`);
        return [category, ...rows].join("\n");
      })
      .join("\n");
  }

  function formatMccAverageBasketValue(matches) {
    if (!Array.isArray(matches) || matches.length === 0) {
      return "Nincs MCC találat.";
    }
    const uniqueMcc = Array.from(new Set(matches.map((match) => match.entry.mcc).filter(Boolean)));
    const lines = uniqueMcc.map((mcc) => {
      const value = MCC_AVG_BASKET_VALUE_HUF.get(mcc);
      if (value == null) return `${mcc}: N/A`;
      const formatted = Number.isFinite(value)
        ? `${value.toLocaleString("hu-HU")} Ft`
        : String(value);
      return `${mcc}: ${formatted}`;
    });
    return lines.join("\n");
  }

  function formatKapcsolatiHaloMetrics(metrics) {
    if (!metrics) return "";
    const avgDegree = Number.isFinite(metrics.averageDegree)
      ? metrics.averageDegree.toFixed(2)
      : "";
    const typeLine = [
      metrics.companyCount ?? "",
      metrics.personCount ?? "",
      metrics.addressCount ?? "",
      metrics.otherCount ?? ""
    ].some((value) => value !== "")
      ? `${metrics.companyCount ?? 0} / ${metrics.personCount ?? 0} / ${metrics.addressCount ?? 0} / ${metrics.otherCount ?? 0}`
      : "";
    const maxDegreeLine = metrics.maxDegree
      ? `${metrics.maxDegree}${metrics.maxDegreeLabel ? ` (${metrics.maxDegreeLabel})` : ""}`
      : "";
    const riskLine = Array.isArray(metrics.riskFlags) && metrics.riskFlags.length
      ? metrics.riskFlags.join("; ")
      : "Nincs kiemelt jelző.";

    return [
      `Összes csomópont: ${metrics.totalNodes ?? 0}`,
      `Összes kapcsolat: ${metrics.totalConnections ?? 0}`,
      avgDegree ? `Átlagos fokszám: ${avgDegree}` : "",
      metrics.inspectedDegree != null ? `Vizsgált cég közvetlen kapcsolatai: ${metrics.inspectedDegree}` : "",
      typeLine ? `Cég/Magánszemély/Cím/Egyéb: ${typeLine}` : "",
      maxDegreeLine ? `Legnagyobb fokszám: ${maxDegreeLine}` : "",
      metrics.isolatedNodes != null ? `Izolált csomópontok: ${metrics.isolatedNodes}` : "",
      `KYC jelzők: ${riskLine}`
    ].filter(Boolean).join("\n");
  }

  async function collectPayload() {
    const data = currentData || await getAllData();
    const val = (v) => v || "";
    const list = (v) => Array.isArray(v) ? v.filter(Boolean).join("; ") : val(v);
    const numeric = (v) => normalizeNumberField(val(v));
    const estimatedMonthlyRevenue = calculateEstimatedCardMonthlyRevenue(data.revenue);
    const activities = Array.isArray(data.activities) ? data.activities : [];
    const kyc = evaluateKycStatus(activities);
    const mccLines = kyc.matches
      .map((match) => `${match.entry.mcc} - ${match.entry.activity} (${match.entry.description})`)
      .filter(Boolean)
      .join("\n");
    const grouped = groupActivities(activities, kyc.matches);
    const groupedActivitiesText = formatGroupedActivities(grouped, activities);
    const haloMetricsText = formatKapcsolatiHaloMetrics(data.haloMetrics);
    const mccBasketValueText = formatMccAverageBasketValue(kyc.matches);

    const signatoryList = (v) => {
      if (!Array.isArray(v)) return val(v);
      return v.map((item, index) => [
        `${index + 1}) Név: ${item.name}`,
        `Beosztás/jogkör: ${item.role}`,
        `Lakcím: ${item.address}`,
        `Születés ideje: ${item.birth}`,
        `Adóazonosító jel: ${item.taxId}`,
        `Hatályos: ${item.hatalyos}`
      ].join(" | ")).join("\n");
    };

    return {
      "Cégnév": val(data.companyName),
      "Cégforma": val(data.companyForm),
      "Alakulás dátuma": val(data.establishmentDate),
      "Bejegyzés dátuma": val(data.registrationDate),
      "Tevékenységi köre(i)": groupedActivitiesText || listActivities(data.activities),
      "Cég székhelye": val(data.headquarters),
      "Cég telephelye(i)": list(data.telephelyek),
      "Cégjegyzékszám": numeric(data.registryNumber),
      "Adószám": numeric(data.taxId),
      "Email": val(data.emails),
      "Értékesítés nettó árbevétele": val(data.revenue),
      "Becsült kártyás nettó havi árbevétele": estimatedMonthlyRevenue,
      "MCC átlagos kosárérték (HUF)": mccBasketValueText,
      "Opten gyorsjelentés": val(data.quickReport),
      "Teya KYC státusz": kyc.status,
      "Teya KYC megjegyzés": kyc.note,
      "Teya KYC MCC találatok": mccLines,
      "Kapcsolati háló KYC metrikák": haloMetricsText,
      "Cégjegyzésre jogosultak": signatoryList(data.signatories),
      "Hány darab cég a cégben van": numeric(data.corporateOwnersCount),
      "Hány kapcsolata van különböző cégekkel": numeric(data.kapcsolatok),
      "EID": val(data.eid),
      "Forrás URL": val(data.sourceUrl)
    };
  }

  function renderDrawer(data) {
    const headerSub = document.getElementById(DRAWER_IDS.sub);
    const cleanedRegistryNumber = normalizeNumberField(data.registryNumber);
    const cleanedTaxId = normalizeNumberField(data.taxId);
    const cleanedKapcsolatok = normalizeNumberField(data.kapcsolatok);
    const cleanedCorporateOwners = normalizeNumberField(data.corporateOwnersCount);
    const estimatedMonthlyRevenue = calculateEstimatedCardMonthlyRevenue(data.revenue);
    if (headerSub) {
      headerSub.innerHTML = [
        cleanedRegistryNumber ? `<span>Cégjegyzékszám: ${cleanedRegistryNumber}</span>` : "",
        cleanedTaxId ? `<span>Adószám: ${cleanedTaxId}</span>` : "",
        data.address ? `<span>${data.address}</span>` : ""
      ].filter(Boolean).join("");
    }

    const body = document.getElementById(DRAWER_IDS.body);
    if (!body) return;
    body.innerHTML = "";

    const activities = Array.isArray(data.activities) ? data.activities : [];
    const telephelyek = Array.isArray(data.telephelyek) ? data.telephelyek : [];
    const signatories = Array.isArray(data.signatories) ? data.signatories : [];
    const bankAccounts = Array.isArray(data.bankAccounts) ? data.bankAccounts : [];

    const kyc = evaluateKycStatus(activities);
    const mccLines = kyc.matches
      .map((match) => `${match.entry.mcc} - ${match.entry.activity} (${match.entry.description})`)
      .filter(Boolean)
      .join("\n");
    const grouped = groupActivities(activities, kyc.matches);
    const groupedActivitiesText = formatGroupedActivities(grouped, activities);
    const haloMetricsText = formatKapcsolatiHaloMetrics(data.haloMetrics);
    const mccBasketValueText = formatMccAverageBasketValue(kyc.matches);

    const coreRows = [
      buildRow("Cégnév", data.companyName),
      buildRow("Cégforma", data.companyForm),
      buildRow("Alakulás dátuma", data.establishmentDate),
      buildRow("Bejegyzés dátuma", data.registrationDate),
      buildRow("Cég székhelye", data.headquarters, { multiline: true }),
      buildRow("Cégjegyzékszám", cleanedRegistryNumber),
      buildRow("Adószám", cleanedTaxId),
      buildRow("Email", data.emails, { multiline: true }),
      buildRow("Értékesítés nettó árbevétele", data.revenue),
      buildRow("Opten gyorsjelentés", data.quickReport)
    ];

    const computedRows = [
      buildRow("Becsült kártyás nettó havi árbevétele", estimatedMonthlyRevenue),
      buildRow("MCC átlagos kosárérték (HUF)", mccBasketValueText, { multiline: true }),
      buildRow("Hány darab cég a cégben van", cleanedCorporateOwners),
      buildRow("Hány kapcsolata van különböző cégekkel", cleanedKapcsolatok),
      buildRow("Kapcsolati háló KYC metrikák", haloMetricsText, { multiline: true })
    ];

    body.appendChild(buildSection("Cég adatok", coreRows));
    body.appendChild(buildSection("Számolt mezők", computedRows));

    if (activities.length) {
      body.appendChild(buildSection("Tevékenységi körök", [
        buildRow("Összesítés", groupedActivitiesText || listActivities(activities), { multiline: true })
      ]));
    }

    body.appendChild(buildSection("KYC ellenőrzés", [
      buildRow("Státusz", kyc.status),
      buildRow("Megjegyzés", kyc.note, { multiline: true }),
      buildRow("MCC találatok", mccLines, { multiline: true })
    ]));

    telephelyek.forEach((telephely, index) => {
      body.appendChild(buildSection(`Telephely ${index + 1}`, [buildRow("Cím", telephely, { multiline: true })]));
    });

    signatories.forEach((person, index) => {
      body.appendChild(buildSection(`Cégjegyzésre jogosult ${index + 1}`, [
        buildRow("Név", person.name),
        buildRow("Beosztás/jogkör", person.role),
        buildRow("Lakcím", person.address, { multiline: true }),
        buildRow("Születés ideje", person.birth),
        buildRow("Adóazonosító jel", person.taxId),
        buildRow("Hatályos", person.hatalyos)
      ]));
    });

    const bankCardRefs = bankAccounts.map((entry, index) => {
      const bankLabelSuffix = entry.bankName ? ` - ${entry.bankName}` : "";
      const sectionTitle = `Bankszámla ${index + 1}${bankLabelSuffix}`;
      const accountRow = buildRow("Bankszámlaszám", entry.account);
      const ibanRow = buildRow("IBAN", "Számítás folyamatban...");
      const checkerRow = buildRow("IBAN ellenőrzés", "Várakozás...", { multiline: true });
      const section = buildSection(sectionTitle, [accountRow, ibanRow, checkerRow]);
      body.appendChild(section);
      return {
        account: entry.account,
        bankName: entry.bankName || "",
        ibanInput: ibanRow.querySelector(".teya-value"),
        checkerInput: checkerRow.querySelector(".teya-value")
      };
    });

    if (bankAccounts.length) {
      calculateIbans(bankAccounts).then((map) => {
        bankCardRefs.forEach((ref) => {
          const iban = map.get(ref.account) || "";
          ref.ibanInput.value = iban || "IBAN számítás sikertelen";

          if (!iban || iban.toLowerCase().includes("sikertelen")) {
            ref.checkerInput.value = "IBAN ellenőrzés nem elérhető.";
            return;
          }

          requestIbanChecker(iban, ref.bankName).then((details) => {
            if (!details.length) {
              ref.checkerInput.value = "Nincs elérhető IBAN részlet.";
              return;
            }
            ref.checkerInput.value = details.map(([k, v]) => `${k}: ${v}`).join("\n");
            ref.checkerInput.rows = Math.min(10, Math.max(3, details.length));
          }).catch(() => {
            ref.checkerInput.value = "IBAN ellenőrzés sikertelen.";
          });
        });
      });
    }
  }

  function closeDrawer() {
    document.getElementById(DRAWER_IDS.drawer)?.classList.remove("show");
    document.getElementById(DRAWER_IDS.backdrop)?.classList.remove("show");
  }

  function openDrawer() {
    ensureDrawer();
    renderLoading();
    document.getElementById(DRAWER_IDS.drawer)?.classList.add("show");
    document.getElementById(DRAWER_IDS.backdrop)?.classList.add("show");
    loadDataAndRender();
  }

  async function loadDataAndRender() {
    const data = await getAllData();
    currentData = data;
    renderDrawer(data);
  }

  // -------------------------
  // Menu injection (robust)
  // -------------------------
  function findReportNode() {
    // 1) ha van fix id
    const byId = document.getElementById("aujcegriport");
    if (byId) return byId;

    // 2) ha href-ben benne van
    const byHref = document.querySelector("a[href*='/cegtar/cegriport/']");
    if (byHref) return byHref;

    // 3) text alapú keresés a sidebar környékén
    const sidebar = document.querySelector("#sidebar-menu-blocks") ||
                    document.querySelector(".sidebar-menu-blocks") ||
                    document.querySelector("aside") ||
                    document.body;

    const candidates = Array.from(sidebar.querySelectorAll("a, button, label, span, div"))
      .filter((el) => normalizeSpace(el.textContent).toLowerCase() === "riport");

    // preferáljuk a linket
    const link = candidates.find((el) => el.tagName.toLowerCase() === "a");
    return link || candidates[0] || null;
  }

  function insertMenuItem() {
    if (document.getElementById(INSERTED_LI_ID)) return;

    const reportNode = findReportNode();
    if (!reportNode) return;

    const reportItem = reportNode.closest("li.list-group-item, li, .list-group-item") || reportNode;
    const parent = reportItem.parentElement;
    if (!parent) return;

    // a beszúrandó elem típusa illeszkedjen a menühöz
    const tag = (reportItem.tagName || "LI").toLowerCase();
    const item = document.createElement(tag);
    item.id = INSERTED_LI_ID;
    item.className = reportItem.className || "list-group-item";

    item.innerHTML = `
      <a id="${INSERTED_A_ID}" class="w-100 d-flex align-items-center" href="#" title="Teya Onboarding">
        <i class="fa-regular fa-square-check"></i>
        <label class="ms-2">Teya Onboarding</label>
      </a>
    `.trim();

    parent.insertBefore(item, reportItem);

    item.querySelector("a")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
    });
  }

  // -------------------------
  // Boot
  // -------------------------
  async function boot() {
    insertMenuItem();

    // SPA/partial render: figyelünk, de throttled
    let t = null;
    const mo = new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        insertMenuItem();
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // extra retry, ha a menü később épül
    for (let i = 0; i < 12; i++) {
      if (document.getElementById(INSERTED_LI_ID)) break;
      insertMenuItem();
      await sleep(400);
    }
  }

  boot();
})();
