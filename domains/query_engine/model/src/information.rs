// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Ordered, producer-defined information shown for query-engine entities.

use quent_model::Attributes;
use serde::{Deserialize, Serialize};

/// A producer-defined heading and its information items, in display order.
#[derive(Debug, Attributes, Deserialize, Serialize)]
pub struct InformationGroup {
    pub heading: String,
    pub items: quent_model::attributes::DynamicAttributes,
}

/// Ordered producer-defined information groups.
pub type InformationGroups = Vec<InformationGroup>;
