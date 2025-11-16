// Reviews Schema Updater
// This script updates the Schema.org markup with real reviews data from Firestore

import { db, collection, getDocs, doc } from './firebase-config.js';

const REVIEWS_DOC_ID = 'reviews-data';

async function updateSchemaMarkup() {
    try {
        // Get reviews data from Firestore
        const reviewsSnapshot = await getDocs(collection(db, 'reviews'));
        let reviewsData = null;
        
        reviewsSnapshot.forEach((docSnapshot) => {
            if (docSnapshot.id === REVIEWS_DOC_ID) {
                reviewsData = docSnapshot.data();
            }
        });
        
        // If no reviews data, use defaults
        if (!reviewsData) {
            reviewsData = {
                ratingValue: "5",
                reviewCount: "0"
            };
        }
        
        // Find and update the Schema.org script tag
        const schemaScript = document.querySelector('script[type="application/ld+json"]');
        if (!schemaScript) {
            console.warn('Schema.org script tag not found');
            return;
        }
        
        try {
            const schemaData = JSON.parse(schemaScript.textContent);
            
            // Find LocalBusiness schema and update aggregateRating
            if (Array.isArray(schemaData)) {
                schemaData.forEach((item) => {
                    if (item['@type'] === 'LocalBusiness' && item.aggregateRating) {
                        item.aggregateRating.ratingValue = reviewsData.ratingValue || "5";
                        item.aggregateRating.reviewCount = reviewsData.reviewCount || "0";
                    }
                });
            } else if (schemaData['@type'] === 'LocalBusiness' && schemaData.aggregateRating) {
                schemaData.aggregateRating.ratingValue = reviewsData.ratingValue || "5";
                schemaData.aggregateRating.reviewCount = reviewsData.reviewCount || "0";
            }
            
            // Update the script tag with new data
            schemaScript.textContent = JSON.stringify(schemaData, null, 2);
            
            console.log('Schema.org markup updated with reviews data:', reviewsData);
            
        } catch (parseError) {
            console.error('Error parsing Schema.org JSON:', parseError);
        }
        
    } catch (error) {
        console.error('Error updating Schema markup:', error);
        // Fallback: keep default values
    }
}

// Update on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSchemaMarkup);
} else {
    updateSchemaMarkup();
}

