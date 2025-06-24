const TrustIndicators = () => {
  const companies = [
    "Microsoft",
    "Salesforce", 
    "HubSpot",
    "Zendesk",
    "Shopify"
  ];

  return (
    <section className="py-12 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-text-muted font-medium">Trusted by 500+ enterprises worldwide</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center opacity-60">
          {companies.map((company) => (
            <div key={company} className="flex justify-center">
              <span className="text-2xl font-bold text-gray-400">{company}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;
