// ==UserScript==
// @name         Opten – Teya Onboarding menüpont (Riport fölé, no default redirect)
// @namespace    https://teya.local/
// @version      1.2.0
// @description  "Teya Onboarding" menüpont beszúrása a bal oldali menübe a Riport fölé, default navigáció nélkül. Oldalsó drawer + mezőnkénti copy, onboardinghoz szükséges adatokkal.
// @author       You
// @match        https://www.opten.hu/*
// @match        https://opten.hu/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      iban.hu
// @connect      www.iban.hu
// @connect      greip.io
// ==/UserScript==

(() => {
  "use strict";

  // -------------------------
  // CONFIG (opcionális)
  // -------------------------
  const TEYA_ONBOARDING_BASE_URL = "";

  const INSERTED_LI_ID = "teya-onboarding-li";
  const INSERTED_A_ID  = "teya-onboarding-link";

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
    const accounts = Array.from(root.querySelectorAll("#subhead-32 .head-title h3"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    return Array.from(new Set(accounts));
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
      kapcsolatok: count ? String(count) : ""
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

    const companyBoxes = boxes.filter((box) => String(box?.Type || "").toLowerCase() === "company");
    const inspectedBox = boxes.find((box) => String(box?.BoxColumn || "").toLowerCase() === "inspectedcompany");
    const companyIds = new Set(
      companyBoxes.map((box) => String(box?.ID ?? box?.Id ?? box?.EID ?? box?.eid ?? "")).filter(Boolean)
    );
    if (inspectedBox) {
      companyIds.delete(String(inspectedBox.ID ?? inspectedBox.Id ?? ""));
    }

    const companyCount = companyIds.size;
    return {
      corporateOwnersCount: companyCount ? String(companyCount) : "",
      kapcsolatok: lineCount ? String(lineCount) : (companyCount ? String(companyCount) : "")
    };
  }

  // -------------------------
  // IBAN helpers (iban.hu + greip.io)
  // -------------------------
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

  function parseIbanCheckerFromHtml(html) {
    const emptyMessage = "IBAN ellenőrzés: 🏦 Want to validate an IBAN? Enter it above and let's take a peek 😄";
    const doc = htmlToDocument(html);
    const table = doc.querySelector(".result table") || doc.querySelector("table");
    if (!table) {
      const fallback = normalizeSpace(doc.querySelector(".result")?.textContent || "");
      return [["IBAN ellenőrzés", fallback || emptyMessage]];
    }
    const rows = Array.from(table.querySelectorAll("tr"));
    const details = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      const key = normalizeSpace(cells[0].textContent).replace(/:$/, "");
      const value = normalizeSpace(cells[1].textContent);
      if (key && value) details.push([key, value]);
    });
    return details.length ? details : [["IBAN ellenőrzés", emptyMessage]];
  }

  function requestIbanFromCalculator(account, countryCode = "HU") {
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

  function requestIbanChecker(iban) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest not available"));
        return;
      }
      const url = new URL("https://greip.io/tools/IBAN-Validation");
      const normalized = normalizeAccount(iban).toUpperCase();
      const params = new URLSearchParams({
        iban: normalized,
        GreCapToken: "",
        submit: ""
      });
      url.search = params.toString();
      GM_xmlhttpRequest({
        method: "GET",
        url: url.toString(),
        anonymous: true,
        onload: (response) => resolve(parseIbanCheckerFromHtml(response.responseText || "")),
        onerror: () => reject(new Error("IBAN checker failed"))
      });
    });
  }

  function buildRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeAccount(account) {
    return normalizeSpace(account).replace(/[^0-9a-z]/gi, "");
  }

  async function calculateIbans(accounts) {
    const results = new Map();
    for (const account of accounts) {
      const normalized = normalizeAccount(account).toUpperCase();
      if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
        results.set(account, normalized);
        continue;
      }
      const iban = await requestIbanFromCalculator(normalized, "HU");
      results.set(account, iban || "IBAN számítás sikertelen");
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
      "Opten gyorsjelentés": val(data.quickReport),
      "Teya KYC státusz": kyc.status,
      "Teya KYC megjegyzés": kyc.note,
      "Teya KYC MCC találatok": mccLines,
      "Cégjegyzésre jogosultak": signatoryList(data.signatories),
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
      buildRow("Hány kapcsolata van különböző cégekkel", cleanedKapcsolatok)
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

    const bankCardRefs = bankAccounts.map((account, index) => {
      const accountRow = buildRow("Bankszámlaszám", account);
      const ibanRow = buildRow("IBAN", "Számítás folyamatban...");
      const checkerRow = buildRow("IBAN ellenőrzés", "Várakozás...", { multiline: true });
      const section = buildSection(`Bankszámla ${index + 1}`, [accountRow, ibanRow, checkerRow]);
      body.appendChild(section);
      return {
        account,
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

          requestIbanChecker(iban).then((details) => {
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
