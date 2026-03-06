export const CC = {
  tropical:'#00ff6a', cancer:'#ff3333', cardiovascular:'#ff8c1a',
  neurological:'#b44dff', respiratory:'#3399ff', autoimmune:'#ff3d8e',
  metabolic:'#ffd500', infectious:'#00e6b8', genetic:'#ff5cbf', mental:'#7c3aed',
};
export const CATS = Object.keys(CC);
export const CL = {
  tropical:'Tropical / NTD', cancer:'Cancer', cardiovascular:'Cardiovascular',
  neurological:'Neurological', respiratory:'Respiratory', autoimmune:'Autoimmune',
  metabolic:'Metabolic', infectious:'Infectious', genetic:'Genetic', mental:'Mental Health',
};
export const MN = 0.3, MX = 55, MAX_PAPERS = 450000, MAX_MORT = 1400000;
export const RANDOM_PICK_DISEASES = [
  {id:'sepsis',fact:'Sepsis kills 11M people per year — more than all cancers combined — yet has only 95K papers. That\'s 115 deaths for every paper published.'},
  {id:'breast-cancer',fact:'Breast Cancer has 430,000 papers — more research than any other cancer. Yet it\'s only the 5th deadliest cancer globally.'},
  {id:'rheumatic-heart-disease',fact:'Rheumatic Heart Disease kills 373,000 people per year but has only 9,000 papers. It\'s a disease of poverty — virtually eliminated in wealthy nations.'},
  {id:'cystic-fibrosis',fact:'Cystic Fibrosis has 48 papers for every death — the most researched disease per capita. It primarily affects people of European descent.'},
  {id:'malaria',fact:'Malaria kills 608,000 people per year, 94% in Africa. A child dies of malaria every minute, yet it receives a fraction of cancer research funding.'},
  {id:'alzheimers-disease',fact:'Alzheimer\'s kills 1.9M people per year and research is surging +6%. There is still no cure — only treatments that slow progression.'},
  {id:'covid-19',fact:'COVID-19 generated 300,000 papers in just a few years — the fastest research ramp in scientific history. Research is now declining 10% as the pandemic fades.'},
  {id:'ebola',fact:'Ebola has 40 papers per death — fear drives funding. Despite killing only 300 people per year on average, it receives massive research attention.'},
  {id:'depression',fact:'Depression has 280,000 papers and zero mortality metric. It affects 280M people worldwide and is the leading cause of disability globally.'},
  {id:'tuberculosis',fact:'Tuberculosis kills 1.25M people per year with only 0.09 papers per death. It\'s the deadliest infectious disease and has existed for thousands of years.'},
  {id:'sickle-cell-disease',fact:'Sickle Cell Disease kills 376,000 people per year — mostly in Africa. It\'s the most common genetic disease globally but remains severely under-researched.'},
  {id:'rotavirus',fact:'Rotavirus kills 200,000 children per year, and research is declining. A vaccine exists but remains inaccessible in the countries that need it most.'},
];
