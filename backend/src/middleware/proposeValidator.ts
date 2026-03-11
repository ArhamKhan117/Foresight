import { Request, Response, NextFunction } from "express";

export const proposeValidator = (req: Request, res: Response, next: NextFunction) => {
    const { isChecked } = req.body;
    const propose = req.body.data;
    
    console.log("Received propose data:", JSON.stringify(propose, null, 2));
    console.log("isChecked:", isChecked);
    
    // Required fields for market creation
    const requiredFields = ['feedName', 'date', 'creator'];
    const errors: Record<string, string> = {};

    if (!propose) {
        res.status(401).json({ message: "No data provided" });
        return;
    }

    for (const field of requiredFields) {
        if (propose[field] === undefined || propose[field] === null || propose[field] === "") {
            errors[field] = `${field} is required`;
        }
    }

    // Value is required only for crypto markets (marketField: 0)
    if (propose.marketField === 0 && (!propose.value || propose.value === "")) {
        errors.value = "value is required for crypto markets";
    }

    if (propose.feedName && propose.feedName.length > 64) {
        errors.feedName = "Feed name is too long (max 64 characters)";
    }
    
    if (Object.keys(errors).length > 0) {
        console.log("Validation errors:", errors);
        res.status(401).json({ message: "Validation failed", errors });
        return;
    }

    if (!isChecked) {
        res.status(401).json({
            message: "Please check the box to agree to the terms and conditions.",
            errors: { checkbox: "Required" }
        });
        return;
    }
    
    next();
};
